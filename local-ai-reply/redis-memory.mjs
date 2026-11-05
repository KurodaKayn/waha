import { createHash, randomUUID } from 'node:crypto';
import Redis from 'ioredis';

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

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export class RedisMemory {
  constructor({ url, accountId, session, maxMessages = 10,
    historyTtlSeconds = 2_592_000, eventTtlSeconds = 604_800, lockMs = 120_000 }) {
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

  async connect() {
    await this.redis.connect();
  }

  async healthy() {
    return await this.redis.ping() === 'PONG';
  }

  async close() {
    this.redis.disconnect();
  }

  async claim(chatId, messageId) {
    const chatHash = digest([this.accountId, this.session, chatId]);
    const prefix = `waha-ai:v1:{${chatHash}}`;
    const claim = {
      token: randomUUID(),
      historyKey: `${prefix}:history`,
      lockKey: `${prefix}:lock`,
      eventKey: `${prefix}:event:${digest(messageId)}`,
    };
    const status = await this.redis.eval(claimScript, 2,
      claim.eventKey, claim.lockKey, claim.token, this.lockMs);
    return { status: status, claim: claim };
  }

  async history(claim) {
    const messages = await this.redis.lrange(claim.historyKey, -this.maxMessages, -1);
    return messages.map(function (message) { return JSON.parse(message); });
  }

  async assertOwner(claim) {
    if (await this.redis.get(claim.lockKey) !== claim.token) {
      throw new Error('Conversation lease expired');
    }
  }

  async complete(claim, userText, replyText) {
    const result = await this.redis.eval(completeScript, 3,
      claim.lockKey, claim.historyKey, claim.eventKey, claim.token,
      JSON.stringify({ role: 'user', content: userText }),
      JSON.stringify({ role: 'assistant', content: replyText }),
      this.maxMessages, this.historyTtlSeconds, this.eventTtlSeconds);
    if (result !== 1) {
      throw new Error('Conversation lease expired before saving history');
    }
  }

  async release(claim) {
    await this.redis.eval(releaseScript, 1, claim.lockKey, claim.token);
  }
}
