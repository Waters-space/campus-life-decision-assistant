import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export type ManagedHeroCard = {
  id: string
  imageUrl: string
  alt: string
  eyebrow: string
  title: string
  emphasis: string
  description: string
  trust: string
  metricLabel: string
  metricValue: string
  metricCaption: string
  routeLabel: string
  routeValue: string
  signals: string[]
  tone?: 'start' | 'filter' | 'explain' | 'photo' | 'plain'
  showSeal?: boolean
  showTemplateContent?: boolean
  layout?: Partial<Record<'eyebrow' | 'headline' | 'description' | 'trust' | 'summary' | 'route' | 'seal', { x: number; y: number }>>
  overlays?: Array<{
    id: string
    kind: 'text' | 'sticker' | 'image'
    text: string
    x: number
    y: number
    fontSize: number
    fontFamily: 'sans' | 'serif' | 'rounded' | 'handwriting'
    color: string
    shape?: 'pill' | 'circle' | 'star' | 'burst' | 'tag'
    background?: string
    imageUrl?: string
    size?: number
  }>
  templateStyles?: Partial<Record<'eyebrow' | 'headline' | 'description' | 'trust' | 'seal', { fontSize?: number; fontFamily?: 'sans' | 'serif' | 'rounded' | 'handwriting'; color?: string; size?: number }>>
  hiddenTemplateElements?: Array<'eyebrow' | 'headline' | 'description' | 'trust' | 'seal'>
}

export type ManagedNews = {
  id: string
  category: string
  title: string
  summary: string
  details: string
  source?: string
  date: string
  tags: string[]
}

export type ManagedSiteLink = { id: string; title: string; note: string; url: string; icon: string }

export type ManagedContent = { heroPhotos: ManagedHeroCard[]; news: ManagedNews[]; siteLinks: ManagedSiteLink[] }

const moduleDirectory = dirname(fileURLToPath(import.meta.url))
const dataFile = join(moduleDirectory, 'data', 'managed-content.json')

const defaultContent: ManagedContent = {
  heroPhotos: [
    { id: 'start', imageUrl: '/hero-cards/hero-start.svg', alt: '首屏介绍：说清你的条件，答案自然清楚。', eyebrow: '校园生活决策助手', title: '说清你的条件，', emphasis: '答案自然清楚。', description: '告诉我你现在的时间、预算和地点，先把眼前最需要解决的选择收拢起来。', trust: '吃饭、取件、自习、二手，都能从一句话开始', metricLabel: '本次输入', metricValue: '一句话', metricCaption: '不用来回翻找信息', routeLabel: '从条件到行动', routeValue: '现在开始', signals: ['时间', '预算', '地点', '偏好'], tone: 'start', showSeal: true },
    { id: 'campus-wind', imageUrl: '/hero-cards/campus-placeholder.svg', alt: '校园图片占位卡片', eyebrow: '校园风景', title: '替换图片，', emphasis: '讲述校园故事。', description: '请在管理端换成已获授权的校园照片。', trust: '让信息服务也保留校园温度', metricLabel: '自定义素材', metricValue: '01', metricCaption: '替换为你的校园图片', routeLabel: '继续浏览', routeValue: '下一张', signals: ['校园', '生活', '风景', '记录'] },
    { id: 'filter', imageUrl: '/hero-cards/hero-filter.svg', alt: '首屏介绍：每一个限制，都是答案线索。', eyebrow: '校园生活决策助手', title: '每一个限制，', emphasis: '都是答案线索。', description: '赶时间、不吃辣、想少走路都很重要。助手会先排除不合适的选择，再给出能马上执行的建议。', trust: '推荐围绕你的时间、距离、价格与需求判断', metricLabel: '判断线索', metricValue: '4 项', metricCaption: '条件越清楚，建议越贴合', routeLabel: '先筛选，再推荐', routeValue: '更清晰', signals: ['距离', '排队', '价格', '需求'], tone: 'filter', showSeal: true },
    { id: 'campus-sea', imageUrl: '/hero-cards/campus-placeholder.svg', alt: '校园图片占位卡片', eyebrow: '校园风景', title: '记录日常，', emphasis: '连接真实场景。', description: '图片、标题和说明都可以由管理员更新。', trust: '前端内容与智能体入口彼此独立', metricLabel: '自定义素材', metricValue: '02', metricCaption: '替换为你的校园图片', routeLabel: '继续浏览', routeValue: '下一张', signals: ['通知', '活动', '服务', '生活'] },
    { id: 'explain', imageUrl: '/hero-cards/hero-explain.svg', alt: '首屏介绍：建议不是猜测，每一步都有依据。', eyebrow: '校园生活决策助手', title: '建议不是猜测，', emphasis: '每一步都有依据。', description: '为什么推荐、需要多久、哪些条件被满足都会写明白，让你看懂理由后再安心行动。', trust: '结果标注判断依据与数据来源，默认匿名使用', metricLabel: '建议原则', metricValue: '可解释', metricCaption: '看懂之后再去行动', routeLabel: '理由清楚再行动', routeValue: '更安心', signals: ['依据', '路线', '时长', '可信'], tone: 'explain', showSeal: true },
    { id: 'campus-swan', imageUrl: '/hero-cards/campus-placeholder.svg', alt: '校园图片占位卡片', eyebrow: '校园风景', title: '开放代码，', emphasis: '适配不同校园。', description: '替换知识库、技能和品牌素材即可复用。', trust: '一套框架服务不同学校的真实需求', metricLabel: '自定义素材', metricValue: '03', metricCaption: '替换为你的校园图片', routeLabel: '继续浏览', routeValue: '下一张', signals: ['开源', '配置', '复用', '共建'] },
  ],
  news: [
    { id: 'sports-volunteer', category: '校园活动', title: '秋季运动会志愿者招募开启', summary: '报名截止本周五，欢迎加入赛事服务、秩序引导与媒体记录团队。', details: '招募面向全体在校生，培训安排和报名入口将由校团委统一发布，请以官方通知为准。', date: '09 月 12 日', tags: ['热门', '活动通知'] },
    { id: 'library-hours', category: '服务通知', title: '图书馆期中周延长开放', summary: '主馆自习区将在期中周延长开放，晚间请注意离馆时间。', details: '开放区域、具体日期及临时调整会同步更新在图书馆官方渠道，出行前请查看最新公告。', date: '09 月 10 日', tags: ['热门', '精选', '新生答疑'] },
    { id: 'career-week', category: '成长发展', title: '就业指导周系列讲座报名中', summary: '简历优化、面试模拟和生涯规划专场将陆续开展。', details: '讲座面向不同年级开放，场次容量有限，具体时间、地点和报名方式以就业中心公告为准。', date: '09 月 08 日', tags: ['精选', '活动通知'] },
    { id: 'safety-workshop', category: '安全提醒', title: '新学期消防安全培训安排', summary: '各学院将分批组织培训，请关注本班通知并按时参与。', details: '培训内容包含宿舍用电安全、疏散路线和应急处理，相关安排由学院辅导员统一通知。', date: '09 月 06 日', tags: ['热门', '新生答疑'] },
  ],
  siteLinks: [
    { id: 'campus-home', title: '学校官网', note: '学校新闻与公告', url: 'https://example.edu/', icon: 'landmark' },
    { id: 'academic', title: '教务处', note: '选课与教学服务', url: 'https://example.edu/academic', icon: 'graduation' },
    { id: 'library', title: '图书馆', note: '馆藏与自习资源', url: 'https://example.edu/library', icon: 'library' },
    { id: 'student', title: '学生工作处', note: '学生事务服务', url: 'https://example.edu/student', icon: 'users' },
    { id: 'it', title: '信息化服务', note: '校园账号与网络', url: 'https://example.edu/it', icon: 'monitor' },
    { id: 'portal', title: '校园门户', note: '统一办事入口', url: 'https://example.edu/portal', icon: 'book' },
  ],
}

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T }

export function getManagedContent(): ManagedContent {
  if (!existsSync(dataFile)) {
    saveManagedContent(defaultContent)
    return clone(defaultContent)
  }
  try {
    const parsed = JSON.parse(readFileSync(dataFile, 'utf8')) as ManagedContent
    if (!Array.isArray(parsed.heroPhotos) || !Array.isArray(parsed.news) || !Array.isArray(parsed.siteLinks)) throw new Error('invalid content')
    return parsed
  } catch {
    return clone(defaultContent)
  }
}

export function saveManagedContent(content: ManagedContent): ManagedContent {
  mkdirSync(dirname(dataFile), { recursive: true })
  const normalized = clone(content)
  writeFileSync(dataFile, JSON.stringify(normalized, null, 2), 'utf8')
  return normalized
}
