import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { RedisMemory, type ChatMessage } from './redis-memory';

type WahaMessage = {
  from?: string;
  fromMe?: boolean;
  body?: string;
};

type WahaEvent = {
  id?: string;
  event?: string;
  timestamp?: number;
  payload?: WahaMessage;
};

type LlmResponse = {
  error?: { message?: string };
  choices?: Array<{ message?: { content?: string } }>;
};

const port = Number(process.env.PORT ?? 3001);
const wahaUrl = required('WAHA_URL').replace(/\/$/, '');
const wahaApiKey = required('WAHA_API_KEY');
const session = process.env.WAHA_SESSION ?? 'default';
const llmBaseUrl = required('LLM_BASE_URL').replace(/\/$/, '');
const llmApiKey = required('LLM_API_KEY');
const llmModel = required('LLM_MODEL');
const webhookSecret = required('WEBHOOK_SECRET');
const redisUrl = required('REDIS_URL');
const accountId = process.env.WAHA_ACCOUNT_ID ?? 'default';
const systemPrompt = process.env.SYSTEM_PROMPT ??
  'You are a helpful WhatsApp assistant. Reply in the same language as the user. Be concise and accurate.';

const memory = new RedisMemory({
  url: redisUrl,
  accountId: accountId,
  session: session,
  maxMessages: positiveInteger('HISTORY_MAX_MESSAGES', 10),
  historyTtlSeconds: positiveInteger('HISTORY_TTL_SECONDS', 2_592_000),
  eventTtlSeconds: positiveInteger('EVENT_TTL_SECONDS', 604_800),
  lockMs: positiveInteger('CONVERSATION_LOCK_MS', 120_000),
});
const maxBodyBytes = 1_000_000;

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function positiveInteger(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function validSignature(rawBody: Buffer, receivedSignature: string | string[] | undefined): boolean {
  if (!receivedSignature || Array.isArray(receivedSignature)) {
    return false;
  }
  const expectedSignature = createHmac('sha512', webhookSecret)
    .update(rawBody)
    .digest('hex');
  const received = Buffer.from(receivedSignature, 'hex');
  const expected = Buffer.from(expectedSignature, 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function replyChatId(message: WahaMessage | undefined): string | null {
  const id = message?.from;
  if (typeof id !== 'string') {
    return null;
  }
  if (id.endsWith('@s.whatsapp.net')) {
    return `${id.slice(0, -'@s.whatsapp.net'.length)}@c.us`;
  }
  if (id.endsWith('@c.us') || id.endsWith('@lid')) {
    return id;
  }
  return null;
}

function ignoreReason(event: WahaEvent): string | null {
  const message = event.payload;
  if (event.event !== 'message') {
    return 'unsupported event';
  }
  if (message?.fromMe) {
    return 'message sent by this account';
  }
  if (typeof message?.body !== 'string' || message.body.trim().length === 0) {
    return 'empty or non-text message';
  }
  if (!replyChatId(message)) {
    return 'not a direct chat';
  }
  return null;
}

async function generateReply(history: ChatMessage[], body: string): Promise<string> {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: body },
  ];
  const response = await fetch(`${llmBaseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${llmApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: llmModel,
      messages: messages,
      temperature: 0.7,
    }),
  });
  const result = await response.json() as LlmResponse;
  if (!response.ok) {
    throw new Error(`LLM request failed: ${result.error?.message ?? response.status}`);
  }
  const content = result.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('LLM returned no text content');
  }
  return content.trim();
}

async function sendWhatsAppReply(chatId: string, text: string): Promise<void> {
  const response = await fetch(`${wahaUrl}/api/sendText`, {
    method: 'POST',
    headers: {
      'X-Api-Key': wahaApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ session: session, chatId: chatId, text: text }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`WAHA send failed: ${body}`);
  }
}

async function handleEvent(event: WahaEvent): Promise<void> {
  const reason = ignoreReason(event);
  if (reason) {
    console.log(`Ignored event ${event.id}: ${reason}`);
    return;
  }
  const chatId = replyChatId(event.payload);
  if (!chatId) {
    return;
  }
  const body = event.payload?.body?.trim() ?? '';
  const eventId = typeof event.id === 'string' && event.id.length > 0
    ? event.id
    : `${chatId}:${event.timestamp ?? ''}:${body}`;
  const claimed = await memory.claim(chatId, eventId);
  if (claimed.status === 'duplicate') {
    console.log('Ignored duplicate event');
    return;
  }
  if (claimed.status !== 'claimed') {
    throw new Error('Another instance is already replying to this chat');
  }
  try {
    const history = await memory.history(claimed.claim);
    const reply = await generateReply(history, body);
    await memory.assertOwner(claimed.claim);
    await sendWhatsAppReply(chatId, reply);
    await memory.complete(claimed.claim, body, reply);
    console.log('Replied successfully');
  } catch (error) {
    await memory.release(claimed.claim);
    throw error;
  }
}

function sendJson(response: ServerResponse, statusCode: number, value: unknown): void {
  response.writeHead(statusCode, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(value));
}

const server = createServer((request: IncomingMessage, response: ServerResponse) => {
  if (request.method === 'GET' && request.url === '/healthz') {
    memory.healthy().then(function () {
      sendJson(response, 200, { status: 'ok', redis: 'ok' });
    }).catch(function () {
      sendJson(response, 503, { status: 'degraded', redis: 'error' });
    });
    return;
  }
  if (request.method !== 'POST' || request.url !== '/webhook/waha') {
    sendJson(response, 404, { error: 'Not found' });
    return;
  }

  const chunks: Buffer[] = [];
  let receivedBytes = 0;
  request.on('data', (chunk: Buffer) => {
    receivedBytes += chunk.length;
    if (receivedBytes > maxBodyBytes) {
      request.destroy();
      return;
    }
    chunks.push(chunk);
  });
  request.on('end', async () => {
    const rawBody = Buffer.concat(chunks);
    if (!validSignature(rawBody, request.headers['x-webhook-hmac'])) {
      sendJson(response, 401, { error: 'Invalid webhook signature' });
      return;
    }

    let event;
    try {
      event = JSON.parse(rawBody.toString('utf8')) as WahaEvent;
    } catch {
      sendJson(response, 400, { error: 'Invalid JSON' });
      return;
    }

    try {
      await handleEvent(event);
      sendJson(response, 200, { status: 'ok' });
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'Reply failed');
      sendJson(response, 500, { error: 'Reply failed' });
    }
  });
});

async function start() {
  await memory.connect();
  await new Promise<void>(function (resolve: () => void) {
    server.listen({ port: port, host: '0.0.0.0' }, resolve);
  });
  console.log(`WAHA AI reply service listening on port ${port}`);
}

async function stop() {
  server.close();
  await memory.close();
}

process.once('SIGTERM', stop);
process.once('SIGINT', stop);
start().catch(function (error) {
  console.error(error instanceof Error ? error.message : 'Startup failed');
  process.exitCode = 1;
});
