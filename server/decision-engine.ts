export type Intent = 'meal' | 'parcel' | 'study' | 'trade' | 'all'

export type DecisionResponse = {
  intent: Intent
  mode: 'mock' | 'maas'
  primary: Record<string, unknown>
  alternatives: Array<Record<string, unknown>>
  confidence: number
  dataSource: string
  generatedAt: string
  notice?: string
}

export type TradeListingInput = {
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

type TradeListing = TradeListingInput & {
  id: string
  freshness: string
  reason: string
  risk: string
}

const generatedAt = () => new Date().toISOString()
const meta = (intent: Intent, primary: Record<string, unknown>, alternatives: Array<Record<string, unknown>>, confidence = 0.91, dataSource = 'demo-seed-v1'): DecisionResponse => ({
  intent,
  mode: 'mock',
  primary,
  alternatives,
  confidence,
  dataSource,
  generatedAt: generatedAt(),
})

export function detectIntent(message: string): Intent | null {
  const patterns: Record<Exclude<Intent, 'all'>, RegExp> = {
    meal: /吃饭|食堂|餐|饭|预算|忌口|不吃辣|想吃|早点|午饭|晚饭|夜宵/g,
    parcel: /快递|驿站|丰巢|取件|包裹/g,
    study: /自习|教室|空闲|讨论|插座|安静|白板|投影|学习/g,
    trade: /二手|教材|课本|资料|笔记|商品|物品|收一|卖|交易|求购|想买|转手/g,
  }
  const scores = Object.fromEntries(Object.entries(patterns).map(([intent, pattern]) => [intent, (message.match(pattern) ?? []).length])) as Record<Exclude<Intent, 'all'>, number>
  const hits = Object.entries(scores).filter(([, score]) => score > 0)
  if (hits.length >= 2) return 'all'
  if (hits.length === 1) return hits[0][0] as Exclude<Intent, 'all'>
  if (tradeListings.some((listing) => tradeMatchScore(listing, message) > 0)) return 'trade'
  if (/(?:我想要|想找|查找|有没有|搜索)/.test(message)) return 'trade'
  return null
}

export function recommendMeal(message: string): DecisionResponse {
  const hasAllergy = /花生|过敏/.test(message)
  const notSpicy = /不吃辣|不要辣|不辣/.test(message)
  const lowBudget = /预算\s*(?:1[0-2]|十[二二]?元|12元)/.test(message)
  const primary = {
    id: 'dish_043', title: notSpicy || lowBudget ? '番茄鸡蛋盖饭' : '黑椒牛柳石锅饭', canteen: '第三食堂', window: '暖胃小灶',
    price: notSpicy || lowBudget ? 12 : 15, walkMinutes: 5, queueMinutes: 4, mealMinutes: 15, totalMinutes: 24,
    tags: [notSpicy ? '不辣' : '微辣可选', '高蛋白', '顺路'],
    reason: hasAllergy ? '已排除含花生窗口；这份餐食不辣、预算内，前往经管楼也顺路。' : '不辣、预算内，步行和排队约 9 分钟，40 分钟内可从容吃完。',
    safety: '餐品为演示数据；如有严重过敏，请以窗口实际配料为准。',
  }
  const alternatives = [
    { id: 'dish_018', title: '菌菇豆腐煲仔饭', canteen: '第二食堂', price: 13, walkMinutes: 7, queueMinutes: 2, totalMinutes: 25, reason: '排队更短，适合赶时间时选择。', tags: ['素食可选', '不辣'] },
    { id: 'dish_056', title: '照烧鸡腿饭', canteen: '第一食堂', price: 14, walkMinutes: 6, queueMinutes: 6, totalMinutes: 27, reason: '蛋白质更足，去经管楼路线相近。', tags: ['不辣', '饱腹'] },
  ].filter((item) => item.price <= 15 || !lowBudget)
  return meta('meal', primary, alternatives)
}

export function optimizeRoute(_message = ''): DecisionResponse {
  return meta('parcel', {
    id: 'route_001', title: '先取东门丰巢，再到菜鸟驿站', totalDistance: '1.4 km', totalMinutes: 19,
    route: [
      { name: '图书馆', detail: '起点', distance: '0 m' },
      { name: '东门丰巢', detail: '距关门 35 分钟，优先处理', distance: '620 m' },
      { name: '菜鸟驿站', detail: '营业至 21:30', distance: '780 m' },
    ],
    reason: '丰巢临近取件时限，虽然先去它不是绝对最短，但可避免关门风险。',
    map: 'library-east-cainiao',
  }, [{ id: 'route_002', title: '先菜鸟后丰巢', totalDistance: '1.28 km', totalMinutes: 18, reason: '距离略短，但丰巢关门风险较高。' }], 0.88)
}

export function findStudyRoom(_message = ''): DecisionResponse {
  return meta('study', {
    id: 'room_204', title: '笃学楼 B204', building: '笃学楼', room: 'B204', freeWindow: '14:00 - 16:30', walkMinutes: 6,
    capacity: 8, facilities: ['插座', '白板', '可小组讨论'], quietness: '中等偏安静', confidenceLabel: '课表显示空闲',
    reason: '可连续空闲 150 分钟，人数和插座需求匹配，步行距离适中。',
  }, [
    { id: 'room_312', title: '知行楼 A312', building: '知行楼', room: 'A312', freeWindow: '14:00 - 17:00', walkMinutes: 9, capacity: 12, facilities: ['插座', '投影'], confidenceLabel: '课表显示空闲', reason: '空间更大，但距离稍远。' },
    { id: 'room_106', title: '图书馆研讨间 106', building: '图书馆', room: '106', freeWindow: '14:30 - 16:00', walkMinutes: 2, capacity: 4, facilities: ['插座'], confidenceLabel: '演示排期推断', reason: '距离近，适合四人短时讨论。' },
  ], 0.82)
}

const tradeListings: TradeListing[] = [
  { id: 'listing_022', title: '高等数学 第七版 上册', category: '教材', price: 16, condition: '九成新，有少量荧光笔记', author: '同济大学数学系', isbn: '978-7-04-039662-8', location: '西区图书馆', delivery: '线下', contact: '138 0000 1022', freshness: '3 小时前', reason: '关键词和教材版本匹配，价格低于同类中位价，西区取件方便。', risk: '请在校园公共地点当面确认书况，不要进行站外支付。' },
  { id: 'listing_031', title: '高数同济版教材 + 习题册', category: '教材', price: 22, condition: '八成新，含少量笔记', author: '同济大学数学系', isbn: '978-7-04-039662-8', location: '西区宿舍区入口', delivery: '线下', contact: '139 0000 1031', freshness: '今天', reason: '含习题册，适合需要配套练习时选择。', risk: '请在校园公共地点交接，先确认版本与附带习题册。' },
  { id: 'listing_014', title: '高等数学教材 上下册', category: '教材', price: 28, condition: '九五成新', author: '同济大学数学系', isbn: '978-7-04-039662-8', location: '', delivery: '线上', contact: '136 0000 1014', freshness: '昨天', reason: '成色更好，适合希望线上沟通后再安排取件的同学。', risk: '线上沟通请注意核对身份，不要向陌生账号站外转账。' },
]

function normalizeSearchText(value: string) {
  return value.toLocaleLowerCase().replace(/[^\u4e00-\u9fa5a-z0-9]/g, '')
}

function queryFragments(message: string) {
  const normalized = normalizeSearchText(message)
  const fragments = new Set<string>()
  const addFragment = (value: string) => { if (value.length >= 2) fragments.add(value) }
  for (const token of normalized.match(/[a-z0-9]+|[\u4e00-\u9fa5]+/g) ?? []) {
    addFragment(token)
    if (/^[\u4e00-\u9fa5]+$/.test(token)) {
      for (let index = 0; index < token.length - 1; index += 1) addFragment(token.slice(index, index + 2))
    }
  }
  return [...fragments]
}

function tradeMatchScore(listing: TradeListing, message: string) {
  const query = normalizeSearchText(message)
  if (!query) return 0
  const title = normalizeSearchText(listing.title)
  const details = normalizeSearchText(`${listing.category} ${listing.author ?? ''} ${listing.condition}`)
  let score = query.includes(title) || title.includes(query) ? 12 : 0
  for (const fragment of queryFragments(message)) {
    if (title.includes(fragment)) score += 3
    else if (details.includes(fragment)) score += 1
  }
  return score
}

export function matchTrade(message = ''): DecisionResponse {
  const ranked = tradeListings
    .map((listing) => ({ listing, score: tradeMatchScore(listing, message) }))
    .sort((left, right) => right.score - left.score)

  if (!message.trim()) return meta('trade', ranked[0].listing, ranked.slice(1).map(({ listing }) => listing), 0.86)

  const matches = ranked.filter(({ score }) => score > 0).map(({ listing }) => listing)
  if (matches.length) return meta('trade', matches[0], matches.slice(1), 0.86)

  const recommendations = ranked.map(({ listing }) => listing).slice(0, 3)
  return {
    ...meta('trade', { id: 'trade_no_result', title: '没有找到你想要的东西' }, recommendations, 0.42),
    notice: '没有找到你想要的东西',
  }
}

export function publishTradeListing(listing: TradeListingInput): DecisionResponse {
  const published: TradeListing = {
    id: `listing_demo_${Date.now()}`,
    title: listing.title,
    category: listing.category,
    price: listing.price,
    condition: listing.condition,
    imageUrls: listing.imageUrls ?? [],
    author: listing.author,
    isbn: listing.isbn,
    location: listing.location,
    delivery: listing.delivery,
    contact: listing.contact,
    freshness: '刚刚录入',
    reason: '商品已作为演示信息录入；发布后可由有相同需求的同学在二手匹配中筛选到。',
    risk: '演示发布不产生真实交易。正式使用时请在校园公共地点当面确认商品并完成支付。',
  }
  tradeListings.unshift(published)
  return meta('trade', published, [], 0.96)
}

export function coordinateCampusLife(message: string): DecisionResponse {
  const meal = recommendMeal(message).primary
  const parcel = optimizeRoute().primary
  const study = findStudyRoom().primary
  const trade = matchTrade().primary
  return meta('all', {
    id: 'campus_link_001',
    title: '一条安排，四类需求',
    summary: '已联动食堂、快递、空闲教室和二手匹配四个演示知识库，按同一段时间统一整理。',
    modules: [
      { id: 'meal', label: '吃饭推荐', title: meal.title, detail: `${meal.canteen} · ${meal.window} · ¥${meal.price}`, details: [`步行 ${meal.walkMinutes} 分钟，预计排队 ${meal.queueMinutes} 分钟`, `约 ${meal.totalMinutes} 分钟可完成`, `标签：${(meal.tags as string[]).join('、')}`] },
      { id: 'parcel', label: '快递路线', title: parcel.title, detail: `预计 ${parcel.totalMinutes} 分钟 · ${parcel.totalDistance}`, details: ['起点：图书馆', '第一站：东门丰巢，临近取件时限', '第二站：菜鸟驿站，营业至 21:30'] },
      { id: 'study', label: '空闲教室', title: `${study.building} ${study.room}`, detail: `${study.freeWindow} · 步行 ${study.walkMinutes} 分钟`, details: [`可用时段：${study.freeWindow}`, `设施：${(study.facilities as string[]).join('、')}`, `可信度：${study.confidenceLabel}`] },
      { id: 'trade', label: '二手匹配', title: trade.title, detail: `${trade.condition} · ¥${trade.price} · ${trade.location}`, details: [`分类：${trade.category}`, `交接：${trade.delivery}`, '请在校园公共地点当面确认书况，不进行站外支付'] },
    ],
    reason: '建议先完成餐食和快递，再前往教室；二手信息保留在同一条行程里，方便按时间决定是否查看。',
    safety: '四个模块均为演示知识库结果；实际营业、教室、快递和商品信息请以校内最新信息为准。',
  }, [], 0.89, 'demo-multi-v1')
}

export function recommendSystemOptions(): DecisionResponse {
  const coordinated = coordinateCampusLife('').primary
  return {
    ...meta('all', {
      ...coordinated,
      id: 'campus_no_match',
      title: '没有找到你想要的东西',
      summary: '未能从当前演示数据中找到和输入完全相符的内容。下面提供四个模块的系统推荐，方便继续浏览或换个关键词再试。',
      reason: '系统没有把不相关的测试数据伪装成匹配结果，而是明确展示了可继续参考的推荐内容。',
    }, [], 0.42, 'demo-recommendation-v1'),
    notice: '没有找到你想要的东西',
  }
}

export function decide(message: string): DecisionResponse {
  const intent = detectIntent(message)
  if (!intent) return recommendSystemOptions()
  switch (intent) {
    case 'all': return coordinateCampusLife(message)
    case 'parcel': return optimizeRoute()
    case 'study': return findStudyRoom()
    case 'trade': return matchTrade(message)
    default: return recommendMeal(message)
  }
}
