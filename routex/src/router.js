'use strict'

// RouteX routing core: health tracking, circuit breaker, and strategy ordering.
class ProviderState {
  constructor(def){
    this.def = def
    this.failures = 0
    this.requests = 0
    this.tokens = 0
    this.openUntil = 0 // circuit breaker open until this timestamp
  }
  get healthy(){ return Date.now() >= this.openUntil }
  recordSuccess(tokens=0){ this.failures = 0; this.requests++; this.tokens += tokens }
  recordFailure(){
    this.failures++
    const threshold = this.def.breakerThreshold || 3
    if (this.failures >= threshold){
      this.openUntil = Date.now() + (this.def.cooldownMs || 30000)
    }
  }
  status(){
    return {
      id: this.def.id, name: this.def.name || this.def.id, tier: this.def.tier || 'api',
      healthy: this.healthy, failures: this.failures, requests: this.requests,
      tokens: this.tokens, priority: this.def.priority ?? 100,
      cooldownMs: Math.max(0, this.openUntil - Date.now()),
      mock: !!this.def.mock, models: this.def.models || []
    }
  }
}

function supportsModel(def, model){
  if (!model || model === 'auto' || model.startsWith('auto/')) return true
  if (model.includes('/')) return model.split('/')[0] === def.id
  const models = def.models || []
  return models.length === 0 || models.includes(model)
}

function upstreamModel(def, model){
  if (!model || model === 'auto' || model.startsWith('auto/')){
    return (def.models && def.models[0]) || 'gpt-3.5-turbo'
  }
  if (model.includes('/') && model.split('/')[0] === def.id){
    return model.split('/').slice(1).join('/')
  }
  return model
}

class Router {
  constructor(providers, opts={}){
    this.states = providers.map(p => new ProviderState(p))
    this.strategy = opts.strategy || 'priority'
    this._rr = 0
  }
  candidates(model){
    const list = this.states.filter(s => s.healthy && supportsModel(s.def, model))
    return this.order(list)
  }
  order(list){
    const arr = [...list]
    switch (this.strategy){
      case 'round-robin': {
        const n = arr.length; if (!n) return arr
        const out = []; for (let i=0;i<n;i++) out.push(arr[(this._rr+i)%n])
        this._rr = (this._rr + 1) % n; return out
      }
      case 'random': return arr.sort(() => Math.random() - 0.5)
      case 'least-used': return arr.sort((a,b) => a.requests - b.requests)
      case 'cost-optimized': return arr.sort((a,b) => (a.def.costPer1k||0) - (b.def.costPer1k||0))
      case 'priority':
      default: return arr.sort((a,b) => (a.def.priority??100) - (b.def.priority??100))
    }
  }
  status(){ return this.states.map(s => s.status()) }
}

module.exports = { Router, ProviderState, supportsModel, upstreamModel }
