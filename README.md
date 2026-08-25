<div align="center">

<img src="assets/routex-logo.png" alt="RouteX Logo" width="220"/>

# 🚀 RouteX — The Free AI Gateway

**Every AI tool → many providers → through one endpoint.**  
One OpenAI-compatible URL, automatic fallback across providers, live health &amp; routing — `$0` to start.

<sub>Built by <b>Rikshit Joshi</b> · Instagram <a href="https://instagram.com/whoisrikshit">@whoisrikshit</a></sub>

</div>

---

## ✨ What RouteX does

Point any OpenAI-compatible tool (Claude Code, Cursor, Cline, your own scripts) at **one** local endpoint. RouteX picks a provider, and if it fails or runs out of quota, RouteX **automatically falls back** to the next healthy one.

- 🌐 **One endpoint** — `http://localhost:20128/v1` speaks the OpenAI API
- 🔁 **Auto-fallback** — tries providers in order until one succeeds
- 🌊 **Streaming (SSE)** — set `"stream": true` for real-time token streaming, piped from the chosen provider
- 🧠 **5 routing strategies** — `priority`, `round-robin`, `random`, `least-used`, `cost-optimized`
- 🧱 **Circuit breaker** — unhealthy providers cool down automatically, then recover
- 🆓 **Works out of the box** — a built-in free/mock provider answers with zero keys
- 📊 **Live dashboard** — provider health, requests, tokens at `http://localhost:20128`
- 🔌 **11 providers preconfigured** — OpenAI, Groq, Cerebras, Gemini, Mistral, DeepSeek, Together, Fireworks, OpenRouter, Ollama + built-in free (or any OpenAI-compatible base URL)

## ⚡ Quick Start

```bash
# 1) Run it (Node 18+)
node bin/routex.js
# or, after npm i -g .
routex
```

Dashboard → `http://localhost:20128` · API → `http://localhost:20128/v1`

```bash
# 2) Call it — zero config, the built-in free provider answers
curl http://localhost:20128/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"auto","messages":[{"role":"user","content":"Hello RouteX!"}]}'

# 3) Stream tokens in real time
curl -N http://localhost:20128/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"auto","stream":true,"messages":[{"role":"user","content":"Stream this!"}]}'
```

## 🔑 Add real providers

Edit `providers.json` and set the matching keys (copy `.env.example` → `.env`):

```json
{
  "id": "groq", "name": "Groq", "tier": "free", "priority": 10,
  "baseUrl": "https://api.groq.com/openai/v1",
  "apiKeyEnv": "GROQ_API_KEY",
  "models": ["llama-3.3-70b-versatile"]
}
```

Call a specific provider with `provider/model` (e.g. `groq/llama-3.3-70b-versatile`) or just use `auto`.

## 🛠️ CLI

```bash
routex            # start gateway + dashboard
routex doctor     # check config + which keys are set
routex providers  # list configured providers
routex --help
```

## 🧪 Verify

```bash
npm test          # boots the server and runs an end-to-end self-test
```

## 📐 Config reference

| Env | Meaning |
| --- | --- |
| `ROUTEX_PORT` | Port (default `20128`) |
| `ROUTEX_API_KEY` | If set, required as `Authorization: Bearer` on `/v1/*` |
| `ROUTEX_STRATEGY` | `priority` \| `round-robin` \| `random` \| `least-used` \| `cost-optimized` |
| `ROUTEX_CONFIG` | Path to a custom `providers.json` |

Every response carries `X-RouteX-Provider`, `X-RouteX-Strategy`, and `X-RouteX-Developer` headers.

## 📁 Project layout

```
routex/
  bin/routex.js        CLI entry
  src/config.js        config + env loader
  src/router.js        health, circuit breaker, strategies
  src/server.js        OpenAI-compatible HTTP server
  public/dashboard.html  live dashboard
  providers.json       your providers
  test/selftest.js     end-to-end test
```

## 📜 License

MIT © 2026 **Rikshit Joshi**. RouteX is an original implementation; its gateway concept is inspired by the open-source OmniRoute project (MIT).

---

<div align="center">
<sub>Made with ❤️ by <b>Rikshit Joshi</b> — Instagram <a href="https://instagram.com/whoisrikshit">@whoisrikshit</a></sub>
</div>
