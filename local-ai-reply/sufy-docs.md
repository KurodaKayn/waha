# Documentation

Source: https://llm.sufy.com/docs
Retrieved: 2026-11-05

Everything you need to connect a model, make your first request, and follow your usage.

## Quick start

[Create an account](https://llm.sufy.com/register), choose an available [model](https://llm.sufy.com/models) and create an [API key](https://llm.sufy.com/keys). Make sure your account has enough available credit, then send the request below.

### OpenAI Chat Completions API

#### cURL

```sh
curl https://llm.sufy.com/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"MODEL_ID","messages":[{"role":"user","content":"Hello"}]}'
```

#### Python

```python
from openai import OpenAI

client = OpenAI(
    api_key="YOUR_API_KEY",
    base_url="https://llm.sufy.com/v1",
)

response = client.chat.completions.create(
    model="MODEL_ID",
    messages=[{"role": "user", "content": "Hello"}],
)

print(response.choices[0].message.content)
```

#### Node.js

```javascript
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "YOUR_API_KEY",
  baseURL: "https://llm.sufy.com/v1",
});

const response = await client.chat.completions.create({
  model: "MODEL_ID",
  messages: [{ role: "user", content: "Hello" }],
});

console.log(response.choices[0].message.content);
```

### OpenAI Responses API

#### cURL

```sh
curl https://llm.sufy.com/v1/responses \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"MODEL_ID","input":"Hello"}'
```

#### Python

```python
from openai import OpenAI

client = OpenAI(
    api_key="YOUR_API_KEY",
    base_url="https://llm.sufy.com/v1",
)

response = client.responses.create(
    model="MODEL_ID",
    input="Hello",
)

print(response.output_text)
```

#### Node.js

```javascript
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "YOUR_API_KEY",
  baseURL: "https://llm.sufy.com/v1",
});

const response = await client.responses.create({
  model: "MODEL_ID",
  input: "Hello",
});

console.log(response.output_text);
```

### Anthropic Messages API

#### cURL

```sh
curl https://llm.sufy.com/v1/messages \
  -H "x-api-key: YOUR_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"MODEL_ID","max_tokens":1024,"messages":[{"role":"user","content":"Hello"}]}'
```

#### Python

```python
from anthropic import Anthropic

client = Anthropic(
    api_key="YOUR_API_KEY",
    base_url="https://llm.sufy.com",
)

message = client.messages.create(
    model="MODEL_ID",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello"}],
)

print(message.content[0].text)
```

#### Node.js

```javascript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: "YOUR_API_KEY",
  baseURL: "https://llm.sufy.com",
});

const message = await client.messages.create({
  model: "MODEL_ID",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Hello" }],
});

console.log(message.content[0]);
```

Replace YOUR_API_KEY with your API key and MODEL_ID with an available text model ID. Python and Node.js examples require the SDK for the selected protocol. A successful Chat response contains the assistant message in choices.

## Connection & authentication

Use the configured endpoint as the OpenAI-compatible SDK Base URL, and send your API key as a Bearer token. Client libraries may append paths automatically: check whether the Base URL already includes /v1 to avoid duplicating it.

Keep API keys private. Use environment variables on your server; never put keys in public code, browser apps, screenshots or logs. Disable or replace a key if it is exposed.

API endpoint

https://llm.sufy.com/v1

## Models & interfaces

The [model catalog](https://llm.sufy.com/models) shows available model IDs, capabilities and prices. Use the exact model ID in requests. Chat Completions uses POST /v1/chat/completions; Anthropic Messages, image and audio endpoints are also available where supported by the selected model and channel. Parameters and compatibility can vary.

## Credits & pricing

Check current prices and billing units in the model catalog before calling a model. Usage consumes available account credit according to the model and applicable pricing. Purchase [credit packages](https://llm.sufy.com/credit-packages) and check payment status in [orders](https://llm.sufy.com/orders); available packages and balances are shown in the console.

## Usage history

Use the overview to inspect usage and the [usage log](https://llm.sufy.com/usage) to filter requests by date and model. When investigating an issue, record the time, model, error and request ID if available; do not share your API key.

## Troubleshooting

### Quick checklist

Before digging into a specific error, check these essentials:

- Is your API key complete, enabled and within its expiry and quota limits?
- Does the Base URL match your client and avoid a duplicate /v1?
- Are authentication headers, JSON syntax and required fields correct?
- Is the model ID correct, available to your account and compatible with the requested capability?
- Do the account and key have available credit, and is the package active?
- Could request frequency, concurrency, input length, network or timeout settings be the cause?

### Common HTTP status codes

Codes are a starting point; check the response message as providers can report errors differently.

| Status | What to check |
| --- | --- |
| 400 | Check JSON, required fields, parameter values and input length. |
| 401 | Check the key, its status and the authentication header. |
| 402 | Check account credit, package status and key quota. |
| 403 | Check account access, model permissions and key restrictions. |
| 404 | Check the Base URL, request path and model ID. |
| 429 | Reduce request rate and concurrency; retry after a delay. |
| 5xx | Record the error and request ID; retry transient failures cautiously. |

### Slow responses or unexpected answers

For slow requests, check network latency and concurrency, shorten input, and test streaming if the model supports it. For answer quality, clarify the task and output format, provide relevant context, and choose a model suited to the task. Verify factual answers against reliable sources.

### Frequently asked questions

#### Why does authentication fail?

In [API keys](https://llm.sufy.com/keys), check that the key is enabled, has not expired and has remaining key quota. Copy the complete key without spaces or line breaks. For OpenAI-compatible requests, send it in the Authorization header as Bearer YOUR_API_KEY. If the key was exposed, disable it and create a replacement.

#### Why is a model unavailable?

Copy the exact model ID from [the model catalog](https://llm.sufy.com/models); the display name may differ from the ID. Check that the model is available to your account and that the key’s model restrictions allow it. Availability can also depend on the selected endpoint and upstream channel.

#### Why am I told I have insufficient credit?

Check your available balance and package status in the console, then check the key’s own quota in [API keys](https://llm.sufy.com/keys). A key can have a separate limit even when the account has credit. If you purchased a package, check its payment status in [orders](https://llm.sufy.com/orders) and whether it is active in your packages.

#### Why does the request return a path or 404 error?

Check the configured API endpoint above and your client’s URL rules. OpenAI-compatible SDKs typically append /chat/completions to a Base URL ending in /v1; do not add /v1 twice. A raw HTTP request needs the full endpoint path. Use the endpoint that matches the protocol you selected.

#### What should I do when requests are rate limited?

Reduce request frequency and concurrency. Retry after a delay using increasing intervals, and honor Retry-After when the response provides it. Check the error message first: insufficient credit and permission errors need a configuration change, not repeated retries.

#### What if a request times out or fails midway?

Check network connectivity and client timeout settings. Try a smaller input or a non-streaming request to isolate the issue, then verify that the selected model supports the requested capability. A timeout does not necessarily mean the request was not processed: check [usage logs](https://llm.sufy.com/usage) before retrying to avoid unexpected duplicate work or charges.

#### Where can I check prices and charges?

Check current model prices and billing units in [the model catalog](https://llm.sufy.com/models). After a request, inspect its consumption in [usage logs](https://llm.sufy.com/usage). The amount depends on the model and its applicable billing rules; different inputs, outputs and capabilities can be priced differently.

#### What information should I keep when investigating a problem?

Record the request time, model ID, endpoint path, HTTP status and error message. If available, copy the request ID from [usage logs](https://llm.sufy.com/usage) or the response. Remove API keys and sensitive prompt or response content before sharing diagnostic details.
