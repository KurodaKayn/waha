import { createHash, randomUUID } from 'node:crypto';
import Redis from 'ioredis';

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type ConversationClaim = {
  token: string;
  historyKey: string;
  lockKey: string;
  eventKey: string;
};

export type ClaimStatus = 'claimed' | 'duplicate' | 'busy';

export type RedisMemoryOptions = {
  url: string;
  accountId: string;
  session: string;
  maxMessages?: number;
  historyTtlSeconds?: number;
  eventTtlSeconds?: number;
  lockMs?: number;
};

// All keys for one chat share a Redis Cluster hash slot.
const claimScript = `
  if redis.call('EXISTS', KEYS[1]) == 1 then return 'duplicate' end
  if redis.call('SET', KEYS[2], ARGV[1], 'NX', 'PX', ARGV[2]) then
    return 'claimed'
  end
  return 'busy'
`;
const completeScript = `
  if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
  redis.call('RPUSH', KEYS[2], ARGV[2], ARGV[3])
  redis.call('LTRIM', KEYS[2], -tonumber(ARGV[4]), -1)
  redis.call('EXPIRE', KEYS[2], ARGV[5])
  redis.call('SET', KEYS[3], 'done', 'EX', ARGV[6])
  redis.call('DEL', KEYS[1])
  return 1
`;
const releaseScript = `
  if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
  end
  return 0
`;

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export class RedisMemory {
  private readonly accountId: string;
  private readonly session: string;
  private readonly maxMessages: number;
  private readonly historyTtlSeconds: number;
  private readonly eventTtlSeconds: number;
  private readonly lockMs: number;
  private readonly redis: Redis;

  constructor({ url, accountId, session, maxMessages = 10,
    historyTtlSeconds = 2_592_000, eventTtlSeconds = 604_800, lockMs = 120_000 }: RedisMemoryOptions) {
    this.accountId = accountId;
    this.session = session;
    this.maxMessages = maxMessages;
    this.historyTtlSeconds = historyTtlSeconds;
    this.eventTtlSeconds = eventTtlSeconds;
    this.lockMs = lockMs;
    this.redis = new Redis(url, {
      lazyConnect: true,
      connectTimeout: 3000,
      commandTimeout: 3000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: function (attempt) { return Math.min(attempt * 200, 2000); },
    });
    // Connection URLs may contain credentials; never log the error object.
    this.redis.on('error', function () { console.error('Redis connection error'); });
  }

  async connect(): Promise<void> {
    await this.redis.connect();
  }

  async healthy(): Promise<boolean> {
    return await this.redis.ping() === 'PONG';
  }

  async close(): Promise<void> {
    this.redis.disconnect();
  }

  async claim(chatId: string, messageId: string): Promise<{
    status: ClaimStatus;
    claim: ConversationClaim;
  }> {
    const chatHash = digest([this.accountId, this.session, chatId]);
    const prefix = `waha-ai:v1:{${chatHash}}`;
    const claim: ConversationClaim = {
      token: randomUUID(),
      historyKey: `${prefix}:history`,
      lockKey: `${prefix}:lock`,
      eventKey: `${prefix}:event:${digest(messageId)}`,
    };
    const status = await this.redis.eval(claimScript, 2,
      claim.eventKey, claim.lockKey, claim.token, this.lockMs);
    return { status: status as ClaimStatus, claim: claim };
  }

  async history(claim: ConversationClaim): Promise<ChatMessage[]> {
    const messages = await this.redis.lrange(claim.historyKey, -this.maxMessages, -1);
    return messages.map(function (message): ChatMessage { return JSON.parse(message) as ChatMessage; });
  }

  async assertOwner(claim: ConversationClaim): Promise<void> {
    if (await this.redis.get(claim.lockKey) !== claim.token) {
      throw new Error('Conversation lease expired');
    }
  }

  async complete(claim: ConversationClaim, userText: string, replyText: string): Promise<void> {
    const result = await this.redis.eval(completeScript, 3,
      claim.lockKey, claim.historyKey, claim.eventKey, claim.token,
      JSON.stringify({ role: 'user', content: userText }),
      JSON.stringify({ role: 'assistant', content: replyText }),
      this.maxMessages, this.historyTtlSeconds, this.eventTtlSeconds);
    if (result !== 1) {
      throw new Error('Conversation lease expired before saving history');
    }
  }

  async release(claim: ConversationClaim): Promise<void> {
    await this.redis.eval(releaseScript, 1, claim.lockKey, claim.token);
  }
}
