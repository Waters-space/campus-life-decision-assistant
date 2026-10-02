export type Intent = 'meal' | 'parcel' | 'study' | 'trade' | 'all'
export type Decision = {
  intent: Intent
  mode: 'mock' | 'maas'
  primary: Record<string, unknown>
  alternatives: Array<Record<string, unknown>>
  confidence: number
  dataSource: string
  generatedAt: string
  notice?: string
}

export type TradeListing = {
  title: string
  category: string
  condition: string
  imageUrls?: string[]
  author?: string
  isbn?: string
  price: number
  location: string
  delivery: string
  contact: string
}

export async function decide(message: string): Promise<Decision> {
  const response = await fetch('/api/assistant/decide', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, sessionId: 'demo-session' }),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(error?.message ?? '服务暂时无法响应，请检查本地 API 后重试。')
  }
  return response.json()
}

export async function decideAll(message: string): Promise<Decision> {
  const response = await fetch('/api/assistant/coordinate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, sessionId: 'demo-session' }),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(error?.message ?? '多模块联动暂时无法响应，请稍后再试。')
  }
  return response.json()
}

async function requestModule(path: string, message: string, fallbackMessage: string): Promise<Decision> {
  const response = await fetch(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, sessionId: 'demo-session' }),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(error?.message ?? fallbackMessage)
  }
  return response.json()
}

export function recommendMeal(message: string): Promise<Decision> {
  return requestModule('/api/meal/recommend', message, '吃饭推荐暂时无法响应，请稍后再试。')
}

export function optimizeRoute(message: string): Promise<Decision> {
  return requestModule('/api/route/optimize', message, '快递路线暂时无法响应，请稍后再试。')
}

export function findStudyRoom(message: string): Promise<Decision> {
  return requestModule('/api/study/search', message, '空闲教室暂时无法响应，请稍后再试。')
}

export async function matchTrade(message: string): Promise<Decision> {
  const response = await fetch('/api/trade/match', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, sessionId: 'demo-session' }),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(error?.message ?? '二手信息暂时无法匹配，请稍后再试。')
  }
  return response.json()
}

export async function publishTradeListing(listing: TradeListing): Promise<Decision> {
  const response = await fetch('/api/trade/publish', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(listing),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(error?.message ?? '商品信息暂时无法录入，请稍后再试。')
  }
  return response.json()
}

export async function sendFeedback(): Promise<string> {
  const response = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ module: 'demo', rating: 'queue_long' }) })
  if (!response.ok) throw new Error('反馈暂时未保存，请稍后再试。')
  return (await response.json()).message
}
