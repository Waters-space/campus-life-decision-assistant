import { describe, expect, it } from 'vitest'
import { coordinateCampusLife, decide, findStudyRoom, matchTrade, optimizeRoute, publishTradeListing, recommendMeal } from './decision-engine.js'

describe('decision engine', () => {
  it('routes parcel requests to the route module', () => {
    expect(decide('我有菜鸟驿站和东门丰巢的快递要取').intent).toBe('parcel')
  })

  it('keeps meal primary recommendation within the 15 yuan demo budget', () => {
    const result = recommendMeal('图书馆预算15元，不吃辣，40分钟后去经管楼')
    expect(result.intent).toBe('meal')
    expect(result.primary.price).toBeLessThanOrEqual(15)
  })

  it('uses only mock data without MaaS credentials', () => {
    expect(decide('下午两点找有插座的空教室').mode).toBe('mock')
  })

  it('keeps seller-entered listing details in the mock publish result', () => {
    const result = publishTradeListing({ title: '线性代数教材', category: '教材', condition: '九成新', imageUrls: ['data:image/png;base64,abc'], author: '同济大学数学系', price: 18, location: '西区图书馆', delivery: '线下', contact: '校园平台私信' })
    expect(result.intent).toBe('trade')
    expect(result.primary.title).toBe('线性代数教材')
    expect(result.primary.price).toBe(18)
    expect(matchTrade('想收线性代数教材').primary.contact).toBe('校园平台私信')
    expect(matchTrade('想收线性代数教材').primary.imageUrls).toEqual(['data:image/png;base64,abc'])
  })

  it('routes a request for a newly listed product to trade instead of meal', () => {
    publishTradeListing({ title: '111', category: '其他', condition: '九成新', price: 10, location: '西区图书馆', delivery: '线下', contact: '校园平台私信' })
    expect(decide('我想要111').intent).toBe('trade')
  })

  it('keeps explicitly selected route and study modules independent from free-text intent detection', () => {
    expect(optimizeRoute('下午两点').intent).toBe('parcel')
    expect(findStudyRoom('下午两点').intent).toBe('study')
  })

  it('shows a no-match message before system trade recommendations', () => {
    const result = matchTrade('我想要不存在的便携投影仪')
    expect(result.notice).toBe('没有找到你想要的东西')
    expect(result.primary.title).toBe('没有找到你想要的东西')
    expect(result.alternatives.length).toBeGreaterThan(0)
  })

  it('does not turn an unclassified quick-start query into a meal match', () => {
    const result = decide('今天天气怎么样')
    expect(result.intent).toBe('all')
    expect(result.notice).toBe('没有找到你想要的东西')
    expect((result.primary.modules as unknown[])).toHaveLength(4)
  })

  it('coordinates all four mock knowledge modules for a multi-request', () => {
    const result = coordinateCampusLife('想吃饭、取快递、找教室，还想看看二手教材')
    expect(result.intent).toBe('all')
    expect(Array.isArray(result.primary.modules)).toBe(true)
    expect((result.primary.modules as unknown[])).toHaveLength(4)
  })
})
