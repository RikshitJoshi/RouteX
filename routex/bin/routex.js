#!/usr/bin/env node
'use strict'
const { startServer } = require('../src/server')
const { loadConfig } = require('../src/config')

const args = process.argv.slice(2)
const cmd = args[0] || 'start'

function help(){
  console.log(`RouteX — the free AI gateway  (by Rikshit Joshi · IG @whoisrikshit)

Usage:
  routex [start]        Start the gateway + dashboard (default)
  routex doctor         Check config and provider keys
  routex providers      List configured providers
  routex --help         Show this help

Env:
  ROUTEX_PORT           Port (default 20128)
  ROUTEX_API_KEY        Require this bearer key on /v1/* (optional)
  ROUTEX_STRATEGY       priority | round-robin | random | least-used | cost-optimized
  ROUTEX_CONFIG         Path to a providers.json file
`)
}

;(async () => {
  if (cmd === '--help' || cmd === '-h' || cmd === 'help') return help()
  const cfg = loadConfig()
  if (cmd === 'providers') {
    console.log('Configured providers:')
    cfg.providers.forEach(p => console.log(` - [${p.tier||'?'}] ${p.id} -> ${p.mock?'(built-in mock)':p.baseUrl}  models: ${(p.models||[]).join(', ')||'*'}`))
    return
  }
  if (cmd === 'doctor') {
    console.log('RouteX doctor')
    console.log(' Node:', process.version)
    console.log(' Providers:', cfg.providers.length)
    cfg.providers.forEach(p => {
      const key = p.apiKeyEnv ? (process.env[p.apiKeyEnv] ? 'set' : 'MISSING') : 'n/a'
      console.log(`  - ${p.id}: key=${key} tier=${p.tier||'?'} priority=${p.priority??100}`)
    })
    console.log(' Strategy:', cfg.strategy)
    return
  }
  if (cmd === 'start') return startServer(cfg)
  console.error('Unknown command:', cmd); help(); process.exit(1)
})()
