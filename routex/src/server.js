'use strict'
const http = require('http')
const fs = require('fs')
const path = require('path')
const { Router, upstreamModel } = require('./router')
const { loadConfig } = require('./config')

const BRAND = { dev: 'Rikshit Joshi', ig: 'whoisrikshit', igUrl: 'https://instagram.com/whoisrikshit' }

function json(res, code, obj){
  const body = JSON.stringify(obj)
  res.writeHead(code, { 'Content-Type': 'application/json', 'X-RouteX-Developer': BRAND.dev })
  res.end(body)
}

function readBody(req){
  return new Promise((resolve) => {
    let data = ''
    req.on('data', c => { data += c })
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}) } catch { resolve({}) } })
  })
}

function promptOf(body){
  const last = (body.messages||[]).slice(-1)[0]
  return last ? (typeof last.content==='string'? last.content : JSON.stringify(last.content)) : ''
}

function mockCompletion(body, providerId){
  const prompt = promptOf(body)
  return {
    id: 'routex-' + Math.random().toString(36).slice(2),
    object: 'chat.completion',
    created: Math.floor(Date.now()/1000),
    model: body.model,
    x_routex_provider: providerId,
    choices: [{ index:0, message:{ role:'assistant', content:`[RouteX·${providerId}] You said: ${prompt}` }, finish_reason:'stop' }],
    usage: { prompt_tokens: prompt.length, completion_tokens: 8, total_tokens: prompt.length + 8 }
  }
}

// ---- SSE streaming helpers ----
function sseChunk(id, created, model, delta, providerId, finish){
  return { id, object:'chat.completion.chunk', created, model, x_routex_provider:providerId, choices:[{ index:0, delta, finish_reason: finish || null }] }
}
function sseSend(res, obj){ res.write('data: ' + JSON.stringify(obj) + '\n\n') }
function sseHead(res, state, router){
  res.writeHead(200, {
    'Content-Type':'text/event-stream', 'Cache-Control':'no-cache', 'Connection':'keep-alive',
    'X-RouteX-Provider': state.def.id, 'X-RouteX-Strategy': router.strategy, 'X-RouteX-Developer': BRAND.dev
  })
}
function streamMock(res, body, providerId){
  const text = `[RouteX·${providerId}] You said: ${promptOf(body)}`
  const words = text.split(' ')
  const id = 'routex-' + Math.random().toString(36).slice(2)
  const created = Math.floor(Date.now()/1000)
  sseSend(res, sseChunk(id, created, body.model, { role:'assistant' }, providerId))
  words.forEach((w, idx) => sseSend(res, sseChunk(id, created, body.model, { content:(idx>0?' ':'')+w }, providerId)))
  sseSend(res, sseChunk(id, created, body.model, {}, providerId, 'stop'))
  res.write('data: [DONE]\n\n')
  res.end()
}

async function forward(state, body){
  const def = state.def
  if (def.mock){ return { ok:true, status:200, json: mockCompletion(body, def.id) } }
  const key = def.apiKeyEnv ? process.env[def.apiKeyEnv] : ''
  const url = String(def.baseUrl||'').replace(/\/$/,'') + '/chat/completions'
  const payload = { ...body, model: upstreamModel(def, body.model) }
  const headers = { 'Content-Type':'application/json' }
  if (key) headers['Authorization'] = 'Bearer ' + key
  const res = await fetch(url, { method:'POST', headers, body: JSON.stringify(payload) })
  const text = await res.text()
  let data; try { data = JSON.parse(text) } catch { data = { raw:text } }
  if (data && typeof data === 'object') data.x_routex_provider = def.id
  return { ok: res.ok, status: res.status, json: data }
}

async function forwardStream(state, body, res, router){
  const def = state.def
  if (def.mock){ sseHead(res, state, router); streamMock(res, body, def.id); return { ok:true, headersSent:true, tokens:0 } }
  const key = def.apiKeyEnv ? process.env[def.apiKeyEnv] : ''
  const url = String(def.baseUrl||'').replace(/\/$/,'') + '/chat/completions'
  const payload = { ...body, model: upstreamModel(def, body.model), stream:true }
  const headers = { 'Content-Type':'application/json', 'Accept':'text/event-stream' }
  if (key) headers['Authorization'] = 'Bearer ' + key
  const upstream = await fetch(url, { method:'POST', headers, body: JSON.stringify(payload) })
  if (!upstream.ok || !upstream.body){ return { ok:false, status: upstream.status, headersSent:false } }
  sseHead(res, state, router)
  const reader = upstream.body.getReader()
  const decoder = new TextDecoder()
  while (true){ const { done, value } = await reader.read(); if (done) break; res.write(decoder.decode(value, { stream:true })) }
  res.end()
  return { ok:true, headersSent:true, tokens:0 }
}

function auth(req, cfg){
  if (!cfg.apiKey) return true
  const h = req.headers['authorization'] || ''
  return h === 'Bearer ' + cfg.apiKey
}

function startServer(cfg){
  cfg = cfg || loadConfig()
  const router = new Router(cfg.providers, { strategy: cfg.strategy })
  const dashPath = path.join(__dirname, '..', 'public', 'dashboard.html')

  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://localhost')
    const p = u.pathname

    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    if (req.method === 'OPTIONS'){ res.writeHead(204); return res.end() }

    if (p === '/' || p === '/dashboard'){
      fs.readFile(dashPath, (e, buf) => {
        if (e){ res.writeHead(200,{'Content-Type':'text/html'}); return res.end('<h1>RouteX</h1><p>Dashboard file missing.</p>') }
        res.writeHead(200, { 'Content-Type':'text/html' }); res.end(buf)
      })
      return
    }

    if (p === '/api/status'){
      return json(res, 200, {
        name: 'RouteX', version: '1.1.0', developer: BRAND.dev, instagram: BRAND.igUrl,
        strategy: router.strategy, providers: router.status()
      })
    }

    if (p === '/v1/models'){
      if (!auth(req, cfg)) return json(res, 401, { error:{ message:'Invalid RouteX API key' } })
      const data = []
      for (const s of router.states){
        const ms = s.def.models && s.def.models.length ? s.def.models : ['auto']
        ms.forEach(m => data.push({ id: `${s.def.id}/${m}`, object:'model', owned_by: s.def.id }))
      }
      data.unshift({ id:'auto', object:'model', owned_by:'routex' })
      return json(res, 200, { object:'list', data })
    }

    if (p === '/v1/chat/completions' && req.method === 'POST'){
      if (!auth(req, cfg)) return json(res, 401, { error:{ message:'Invalid RouteX API key' } })
      const body = await readBody(req)
      const model = body.model || 'auto'
      const wantStream = body.stream === true
      const cands = router.candidates(model)
      if (!cands.length) return json(res, 503, { error:{ message:'RouteX: no healthy provider for model '+model } })
      const errors = []
      for (const state of cands){
        try {
          if (wantStream){
            const r = await forwardStream(state, body, res, router)
            if (r.ok){ state.recordSuccess(r.tokens||0); return }
            state.recordFailure(); errors.push(`${state.def.id}:${r.status}`)
            if (r.headersSent) return
          } else {
            const r = await forward(state, body)
            if (r.ok){
              state.recordSuccess(r.json && r.json.usage ? r.json.usage.total_tokens : 0)
              res.setHeader('X-RouteX-Provider', state.def.id)
              res.setHeader('X-RouteX-Strategy', router.strategy)
              res.setHeader('X-RouteX-Developer', BRAND.dev)
              return json(res, 200, r.json)
            }
            state.recordFailure(); errors.push(`${state.def.id}:${r.status}`)
          }
        } catch (e){ state.recordFailure(); errors.push(`${state.def.id}:${e.message}`) }
      }
      if (!res.headersSent) return json(res, 502, { error:{ message:'RouteX: all providers failed', details: errors } })
      return
    }

    json(res, 404, { error:{ message:'Not found' } })
  })

  server.listen(cfg.port, () => {
    console.log(`\n  RouteX ▸ the free AI gateway  (by ${BRAND.dev} · IG @${BRAND.ig})`)
    console.log(`  Dashboard  http://localhost:${cfg.port}`)
    console.log(`  API        http://localhost:${cfg.port}/v1`)
    console.log(`  Providers  ${cfg.providers.length}  ·  Strategy ${router.strategy}\n`)
  })
  return server
}

module.exports = { startServer, mockCompletion, forward, forwardStream }
