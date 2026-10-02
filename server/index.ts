import cors from 'cors'
import express from 'express'
import { existsSync } from 'node:fs'
import { z } from 'zod'
import { createAdminSession, endAdminSession, hasAdminAccount, isAdminSession, registerAdmin, verifyAdmin } from './admin-auth.js'
import { getManagedContent, saveManagedContent } from './content-store.js'
import { coordinateCampusLife, decide, detectIntent, findStudyRoom, matchTrade, optimizeRoute, publishTradeListing, recommendMeal, type Intent } from './decision-engine.js'
import { isMaaSEnabled, runMaaSWorkflow } from './maas-workflow.js'

if (existsSync('.env')) process.loadEnvFile?.('.env')

const app = express()
const port = Number(process.env.API_PORT ?? 8788)
const requestSchema = z.object({ message: z.string().trim().min(2).max(500), sessionId: z.string().max(100).optional() })
const adminCredentialSchema = z.object({ username: z.string().trim().min(3).max(48), password: z.string().min(12).max(128) })
const adminRegistrationSchema = adminCredentialSchema.extend({ phone: z.string().trim().regex(/^1\d{10}$/, '请填写 11 位中国大陆手机号码。'), accessCode: z.string().min(1).max(128) })
const adminInternalCode = process.env.ADMIN_INTERNAL_CODE
const cardPositionSchema = z.object({ x: z.number().min(-20).max(110), y: z.number().min(-20).max(110) })
const cardLayoutSchema = z.object({ eyebrow: cardPositionSchema, headline: cardPositionSchema, description: cardPositionSchema, trust: cardPositionSchema, summary: cardPositionSchema, route: cardPositionSchema, seal: cardPositionSchema }).partial()
const heroOverlaySchema = z.object({ id: z.string().trim().min(2).max(80), kind: z.enum(['text', 'sticker', 'image']), text: z.string().trim().max(100), x: z.number().min(-20).max(110), y: z.number().min(-20).max(110), fontSize: z.number().int().min(10).max(72), fontFamily: z.enum(['sans', 'serif', 'rounded', 'handwriting']), color: z.string().regex(/^#[0-9a-fA-F]{6}$/, '文字颜色格式不正确。'), shape: z.enum(['pill', 'circle', 'star', 'burst', 'tag']).optional(), background: z.string().regex(/^#[0-9a-fA-F]{6}$/, '图案颜色格式不正确。').optional(), imageUrl: z.string().trim().max(4_200_000).refine((value) => value === '' || /^(?:https?:\/\/|\/|data:image\/)/.test(value), '贴图需为图片链接或上传图片。').optional(), size: z.number().int().min(32).max(220).optional() })
const heroTemplateStyleSchema = z.object({ fontSize: z.number().int().min(10).max(72).optional(), fontFamily: z.enum(['sans', 'serif', 'rounded', 'handwriting']).optional(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/, '文字颜色格式不正确。').optional(), size: z.number().int().min(32).max(240).optional() })
const heroTemplateStylesSchema = z.object({ eyebrow: heroTemplateStyleSchema, headline: heroTemplateStyleSchema, description: heroTemplateStyleSchema, trust: heroTemplateStyleSchema, seal: heroTemplateStyleSchema }).partial()
const hiddenTemplateElementsSchema = z.array(z.enum(['eyebrow', 'headline', 'description', 'trust', 'seal'])).max(5).optional()
const contentSchema = z.object({
  heroPhotos: z.array(z.object({
    id: z.string().trim().min(2).max(80), imageUrl: z.string().trim().max(4_200_000).refine((value) => value === '' || /^(?:https?:\/\/|\/|data:image\/)/.test(value), '图片需为站内路径、图片链接或上传图片。'), alt: z.string().trim().min(2).max(160), eyebrow: z.string().trim().max(40), title: z.string().trim().min(2).max(80), emphasis: z.string().trim().max(80), description: z.string().trim().max(240), trust: z.string().trim().max(160), metricLabel: z.string().trim().max(40), metricValue: z.string().trim().max(40), metricCaption: z.string().trim().max(80), routeLabel: z.string().trim().max(40), routeValue: z.string().trim().max(40), signals: z.array(z.string().trim().min(1).max(20)).min(1).max(6), tone: z.enum(['start', 'filter', 'explain', 'photo', 'plain']).optional(), showSeal: z.boolean().optional(), showTemplateContent: z.boolean().optional(), layout: cardLayoutSchema.optional(), overlays: z.array(heroOverlaySchema).max(20).optional(), templateStyles: heroTemplateStylesSchema.optional(), hiddenTemplateElements: hiddenTemplateElementsSchema,
  })).max(20),
  news: z.array(z.object({ id: z.string().trim().min(2).max(80), category: z.string().trim().min(2).max(40), title: z.string().trim().min(2).max(100), summary: z.string().trim().min(2).max(280), details: z.string().trim().min(2).max(900), source: z.string().trim().max(160).optional(), date: z.string().trim().min(2).max(40), tags: z.array(z.string().trim().min(1).max(24)).max(6) })).max(30),
  siteLinks: z.array(z.object({ id: z.string().trim().min(2).max(80), title: z.string().trim().min(2).max(50), note: z.string().trim().min(2).max(100), url: z.string().trim().url().max(500), icon: z.enum(['landmark', 'graduation', 'library', 'users', 'monitor', 'book']) })).max(16),
})
const tradeListingSchema = z.object({
  title: z.string().trim().min(2).max(80),
  category: z.string().trim().min(1).max(30),
  condition: z.string().trim().min(2).max(80),
  imageUrls: z.array(z.string().regex(/^data:image\/(?:jpeg|png|webp);base64,/, '仅支持 JPEG、PNG 或 WebP 图片。').max(4_200_000)).max(6).optional().default([]),
  author: z.string().trim().max(80).optional(),
  isbn: z.string().trim().max(40).optional(),
  price: z.coerce.number().positive().max(10000),
  location: z.string().trim().max(80).optional().default(''),
  delivery: z.enum(['线上', '线下']),
  contact: z.string().trim().min(2).max(100),
}).superRefine((listing, context) => {
  if (listing.category === '教材' && !listing.author) context.addIssue({ code: z.ZodIssueCode.custom, path: ['author'], message: '教材请填写作者或主编。' })
  if (listing.delivery === '线下' && !listing.location) context.addIssue({ code: z.ZodIssueCode.custom, path: ['location'], message: '线下交接请填写交接地点。' })
})

app.use(cors())
app.use(express.json({ limit: '26mb' }))

app.get('/api/health', (_req, res) => res.json({ ok: true, mode: isMaaSEnabled() ? 'maas' : 'mock', dataSource: isMaaSEnabled() ? 'yuanjing-workflow' : 'demo-seed-v1' }))

function handle(handler: (message: string) => unknown | Promise<unknown>) {
  return async (req: express.Request, res: express.Response) => {
    const parsed = requestSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ code: 'INVALID_REQUEST', message: '请用一句完整需求描述你的预算、时间或地点。' })
    try { return res.json(await handler(parsed.data.message)) }
    catch (error) { return res.status(502).json({ code: 'MAAS_UNAVAILABLE', message: error instanceof Error ? error.message : 'MaaS 工作流暂时无法响应，请稍后重试。' }) }
  }
}

async function assistantDecision(message: string, fallbackIntent: Intent) {
  if (!isMaaSEnabled()) return fallbackIntent === 'all' ? decide(message) : fallbackIntent === 'meal' ? recommendMeal(message) : fallbackIntent === 'parcel' ? optimizeRoute(message) : findStudyRoom(message)
  const answer = await runMaaSWorkflow(message)
  const intent = fallbackIntent === 'all' ? detectIntent(message) ?? 'all' : fallbackIntent
  return {
    intent,
    mode: 'maas' as const,
    primary: { id: `maas-${Date.now()}`, title: 'MaaS 智能回答', answer },
    alternatives: [],
    confidence: 1,
    dataSource: '元景 MaaS · 校园生活决策助手',
    generatedAt: new Date().toISOString(),
  }
}

app.post('/api/assistant/decide', handle((message) => assistantDecision(message, 'all')))
app.post('/api/assistant/coordinate', handle((message) => assistantDecision(message, 'all')))
app.post('/api/meal/recommend', handle((message) => assistantDecision(message, 'meal')))
app.post('/api/route/optimize', handle((message) => assistantDecision(message, 'parcel')))
app.post('/api/study/search', handle((message) => assistantDecision(message, 'study')))
app.post('/api/trade/match', handle(matchTrade))
app.post('/api/trade/publish', (req, res) => {
  const parsed = tradeListingSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ code: 'INVALID_LISTING', message: '请补充商品名称、成色、价格、交接方式和联系方式；线下交接还需填写地点，教材还需填写作者或主编。' })
  return res.status(201).json(publishTradeListing(parsed.data))
})

function adminCookie(res: express.Response, token: string) {
  res.cookie('admin_session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 24, path: '/' })
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!isAdminSession(req)) return res.status(401).json({ code: 'ADMIN_AUTH_REQUIRED', message: '请先登录管理后台。' })
  next()
}

app.get('/api/content', (_req, res) => res.json(getManagedContent()))
app.get('/api/admin/status', (req, res) => res.json({ configured: hasAdminAccount(), authenticated: isAdminSession(req) }))
app.post('/api/admin/register', (req, res) => {
  const parsed = adminRegistrationSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ code: 'INVALID_ADMIN_REGISTRATION', message: '请填写至少 3 位用户名、至少 12 位密码和正确的 11 位手机号码。' })
  if (!adminInternalCode || parsed.data.accessCode !== adminInternalCode) return res.status(403).json({ code: 'INVALID_INTERNAL_CODE', message: '内部码不正确，无法创建管理员账号。' })
  if (hasAdminAccount()) return res.status(403).json({ code: 'ADMIN_ALREADY_CONFIGURED', message: '管理员账号已初始化，无法再次创建。' })
  try { registerAdmin(parsed.data.username, parsed.data.password, parsed.data.phone) }
  catch (error) { return res.status(409).json({ code: 'ADMIN_EXISTS', message: error instanceof Error ? error.message : '该管理员用户名已存在。' }) }
  adminCookie(res, createAdminSession(parsed.data.username))
  return res.status(201).json({ ok: true })
})
app.post('/api/admin/login', (req, res) => {
  const parsed = adminCredentialSchema.safeParse(req.body)
  if (!parsed.success || !verifyAdmin(parsed.data.username, parsed.data.password)) return res.status(401).json({ code: 'INVALID_ADMIN_CREDENTIAL', message: '用户名或密码不正确。' })
  adminCookie(res, createAdminSession(parsed.data.username))
  return res.json({ ok: true })
})
app.post('/api/admin/logout', (req, res) => { endAdminSession(req); res.clearCookie('admin_session', { path: '/' }); return res.json({ ok: true }) })
app.get('/api/admin/content', requireAdmin, (_req, res) => res.json(getManagedContent()))
app.put('/api/admin/content', requireAdmin, (req, res) => {
  const parsed = contentSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ code: 'INVALID_CONTENT', message: '请检查图片、新闻和网站链接的必填内容及格式。' })
  if (parsed.data.siteLinks.some((link) => new URL(link.url).pathname === '/admin')) return res.status(400).json({ code: 'INVALID_CONTENT', message: '站内链接不允许指向管理后台。' })
  return res.json(saveManagedContent(parsed.data))
})
app.post('/api/feedback', (req, res) => res.status(201).json({ ok: true, receivedAt: new Date().toISOString(), message: '收到反馈，下次会优先调整排队时间权重。' }))
app.post('/api/demo/reset', (_req, res) => res.json({ ok: true, mode: 'mock', message: '演示数据已重置。' }))

app.use((_req, res) => res.status(404).json({ code: 'NOT_FOUND', message: '未找到该服务，请返回首页重新发起需求。' }))
app.listen(port, () => console.log(`Campus Choice API running on http://localhost:${port}`))
