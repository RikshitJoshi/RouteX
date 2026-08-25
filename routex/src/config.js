'use strict'
const fs = require('fs')
const path = require('path')

function loadConfig(){
  const file = process.env.ROUTEX_CONFIG || path.join(__dirname, '..', 'providers.json')
  let raw = { providers: [], strategy: 'priority' }
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')) }
  catch (e) { console.warn('RouteX: could not read', file, '-', e.message) }
  const providers = Array.isArray(raw.providers) ? raw.providers : []
  return {
    providers,
    strategy: process.env.ROUTEX_STRATEGY || raw.strategy || 'priority',
    port: Number(process.env.ROUTEX_PORT || raw.port || 20128),
    apiKey: process.env.ROUTEX_API_KEY || raw.apiKey || ''
  }
}
module.exports = { loadConfig }
