import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BookOpen, CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, Cloud, Coffee, Compass, ExternalLink, GraduationCap, ImagePlus, Landmark, LibraryBig, MapPin, Megaphone, MonitorSmartphone, Moon, Navigation, Newspaper, PackageCheck, RefreshCcw, Search, Send, ShieldCheck, Sparkles, Store, Sun, ThumbsDown, ThumbsUp, UsersRound, UtensilsCrossed, X,
} from 'lucide-react'
import { decide, decideAll, findStudyRoom, matchTrade, optimizeRoute, publishTradeListing, recommendMeal, sendFeedback, type Decision, type Intent, type TradeListing } from './api'
import CardFanCarousel, { type CardItem } from './components/ui/card-fan-carousel'
import AnimatedCardOption from './components/ui/animated-card-option'
import AnimatedActionButton from './components/ui/animated-action-button'
import { fallbackContent, type CampusSiteLink, type ManagedContent } from './content'

type TradeRole = 'buyer' | 'seller'
type ThemeMode = 'light' | 'dark'
type TradeListingDraft = Omit<TradeListing, 'price' | 'imageUrls'> & { price: string; imageUrls: string[] }

const emptyListing: TradeListingDraft = { title: '', category: '', condition: '', imageUrls: [], author: '', isbn: '', price: '', location: '', delivery: '', contact: '' }

const promptPlaceholders: Record<Exclude<Intent, 'trade' | 'all'>, string> = {
  meal: '输入预算、时间、地点与口味偏好',
  parcel: '输入需要取的快递点与大致时间',
  study: '输入人数、时间段和教室需求',
}

const scenarioInfo: Array<{ intent: Intent; title: string; caption: string; icon: typeof UtensilsCrossed; tone: string }> = [
  { intent: 'meal', title: '吃饭推荐', caption: '预算、忌口、赶课都算好', icon: UtensilsCrossed, tone: 'green' },
  { intent: 'parcel', title: '快递路线', caption: '多点顺路，关门提醒', icon: PackageCheck, tone: 'orange' },
  { intent: 'study', title: '空闲教室', caption: '课表推断，带可信度', icon: BookOpen, tone: 'blue' },
  { intent: 'trade', title: '二手匹配', caption: '教材智能体，快速决策', icon: Store, tone: 'purple' },
]

const newsFilters = ['全部', '热门', '精选', '新生答疑', '活动通知'] as const
type NewsFilter = typeof newsFilters[number]

function siteIconFor(link: CampusSiteLink) {
  return link.icon === 'graduation' ? GraduationCap : link.icon === 'library' ? LibraryBig : link.icon === 'users' ? UsersRound : link.icon === 'monitor' ? MonitorSmartphone : link.icon === 'book' ? BookOpen : Landmark
}

function getText(value: unknown) { return String(value ?? '') }
function list(value: unknown) { return Array.isArray(value) ? value.map(String) : [] }
const acceptedListingImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxListingImages = 6
const maxListingImageBytes = 3 * 1024 * 1024
const maasAgentUrl = import.meta.env.VITE_PRIMARY_AGENT_URL?.trim() ?? ''
const usedBookAgentUrl = import.meta.env.VITE_USED_BOOK_AGENT_URL?.trim() ?? ''

function readImageAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('图片读取失败。'))
    reader.onerror = () => reject(new Error('图片读取失败。'))
    reader.readAsDataURL(file)
  })
}

function App() {
  const [input, setInput] = useState('')
  const [result, setResult] = useState<Decision | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [theme, setTheme] = useState<ThemeMode>('light')
  const [weatherBurst, setWeatherBurst] = useState<{ id: number; mode: ThemeMode } | null>(null)
  const [selected, setSelected] = useState<Intent>('meal')
  const [isScenarioExplicit, setIsScenarioExplicit] = useState(false)
  const [alternativeIndex, setAlternativeIndex] = useState(0)
  const [openNewsId, setOpenNewsId] = useState<string | null>(null)
  const [tradeRole, setTradeRole] = useState<TradeRole>('buyer')
  const [tradeResultRole, setTradeResultRole] = useState<TradeRole | null>(null)
  const [listing, setListing] = useState<TradeListingDraft>(emptyListing)
  const [myListings, setMyListings] = useState<Array<Record<string, unknown>>>([])
  const [showMyListings, setShowMyListings] = useState(false)
  const [myOrders, setMyOrders] = useState<Array<Record<string, unknown>>>([])
  const [showMyOrders, setShowMyOrders] = useState(false)
  const [newsQuery, setNewsQuery] = useState('')
  const [newsFilter, setNewsFilter] = useState<NewsFilter>('全部')
  const [showMoreContent, setShowMoreContent] = useState(false)
  const [managedContent, setManagedContent] = useState<ManagedContent>(fallbackContent)

  const primary = useMemo(() => {
    if (!result) return null
    return alternativeIndex > 0 ? result.alternatives[alternativeIndex - 1] ?? result.primary : result.primary
  }, [result, alternativeIndex])
  const filteredCampusNews = useMemo(() => {
    const keyword = newsQuery.trim().toLocaleLowerCase()
    return managedContent.news.filter((news) => {
      const matchesFilter = newsFilter === '全部' || news.tags.some((tag) => tag === newsFilter)
      const matchesKeyword = !keyword || [news.category, news.title, news.summary, news.details, news.source ?? '', ...news.tags].some((value) => value.toLocaleLowerCase().includes(keyword))
      return matchesFilter && matchesKeyword
    })
  }, [managedContent.news, newsFilter, newsQuery])

  const heroFanCards = useMemo<CardItem[]>(() => {
    const templateArtwork = {
      start: '/hero-cards/hero-start.svg',
      filter: '/hero-cards/hero-filter.svg',
      explain: '/hero-cards/hero-explain.svg',
    } as const

    return managedContent.heroPhotos.map((card) => {
      const tone = card.tone ?? (card.imageUrl ? 'photo' : 'plain')
      const templateTone = tone === 'filter' || tone === 'explain' ? tone : 'start'
      // 与后台预览一致：未上传底图的文字模板使用对应的默认插画。
      const imgUrl = card.imageUrl || (tone === 'photo' ? '' : templateArtwork[templateTone])
      return { ...card, imgUrl, tone, showTemplate: card.showTemplateContent ?? (tone !== 'photo' && tone !== 'plain') }
    })
  }, [managedContent.heroPhotos])

  const refreshManagedContent = useCallback(() => {
    return fetch('/api/content', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() as Promise<ManagedContent> : Promise.reject(new Error('content unavailable')))
      .then(setManagedContent)
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    void refreshManagedContent()
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('campus-managed-content')
    channel?.addEventListener('message', (event: MessageEvent<ManagedContent>) => setManagedContent(event.data))
    const refreshOnFocus = () => { if (document.visibilityState === 'visible') void refreshManagedContent() }
    const refreshOnPublished = (event: StorageEvent) => {
      if (event.key === 'campus-managed-content-updated') void refreshManagedContent()
    }
    window.addEventListener('focus', refreshOnFocus)
    window.addEventListener('storage', refreshOnPublished)
    document.addEventListener('visibilitychange', refreshOnFocus)
    const interval = window.setInterval(() => void refreshManagedContent(), 15_000)
    return () => { channel?.close(); window.removeEventListener('focus', refreshOnFocus); window.removeEventListener('storage', refreshOnPublished); document.removeEventListener('visibilitychange', refreshOnFocus); window.clearInterval(interval) }
  }, [refreshManagedContent])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 3600)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
  }, [theme])

  function toggleTheme() {
    const nextTheme: ThemeMode = theme === 'light' ? 'dark' : 'light'
    setTheme(nextTheme)
    setWeatherBurst({ id: Date.now(), mode: nextTheme })
  }

  async function submit(message = input) {
    const trimmed = message.trim()
    if (trimmed.length < 2) { setError('请告诉我你想解决什么，例如预算、地点或时间。'); return }
    setLoading(true); setError(''); setAlternativeIndex(0)
    try {
      const next = !isScenarioExplicit ? await decide(trimmed)
        : selected === 'all' ? await decideAll(trimmed)
          : selected === 'trade' ? await matchTrade(trimmed)
            : selected === 'parcel' ? await optimizeRoute(trimmed)
              : selected === 'study' ? await findStudyRoom(trimmed)
                : await recommendMeal(trimmed)
      setResult(next); setSelected(next.intent); setTradeResultRole(next.intent === 'trade' ? tradeRole : null)
    } catch (reason) { setError(reason instanceof Error ? reason.message : '请求失败，请稍后重试。') }
    finally { setLoading(false) }
  }

  function chooseScenario(intent: Intent) {
    setSelected(intent); setIsScenarioExplicit(true); setInput(''); setResult(null); setError(''); setAlternativeIndex(0); setTradeResultRole(null)
    if (intent === 'trade') { setTradeRole('buyer'); setShowMyOrders(false); setShowMyListings(false) }
  }

  function selectTradeRole(role: TradeRole) {
    setTradeRole(role)
    setResult(null)
    setError('')
    setTradeResultRole(null)
    setShowMyOrders(false)
    setShowMyListings(false)
  }

  function toggleTradeWorkspace(role: TradeRole) {
    const shouldOpen = role === 'buyer' ? !showMyOrders : !showMyListings
    setShowMyOrders(role === 'buyer' && shouldOpen)
    setShowMyListings(role === 'seller' && shouldOpen)
  }

  function exitTradeWorkspace() {
    setShowMyOrders(false)
    setShowMyListings(false)
  }

  async function addListingImages(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!selectedFiles.length) return
    const availableSlots = maxListingImages - listing.imageUrls.length
    const validFiles = selectedFiles.filter((file) => acceptedListingImageTypes.has(file.type) && file.size <= maxListingImageBytes).slice(0, Math.max(availableSlots, 0))
    if (selectedFiles.length > availableSlots) setToast(`商品图片最多 ${maxListingImages} 张，已保留前 ${Math.max(availableSlots, 0)} 张。`)
    else if (validFiles.length !== selectedFiles.length) setToast('仅支持单张不超过 3MB 的 JPEG、PNG 或 WebP 图片。')
    if (!validFiles.length) return
    try {
      const imageUrls = await Promise.all(validFiles.map(readImageAsDataUrl))
      setListing((current) => ({ ...current, imageUrls: [...current.imageUrls, ...imageUrls].slice(0, maxListingImages) }))
    } catch (reason) { setError(reason instanceof Error ? reason.message : '图片暂时无法读取，请重新选择。') }
  }

  function removeListingImage(index: number) {
    setListing((current) => ({ ...current, imageUrls: current.imageUrls.filter((_, imageIndex) => imageIndex !== index) }))
  }

  async function submitListing() {
    const price = Number(listing.price)
    const isOfflineDelivery = listing.delivery === '线下'
    if (!listing.title.trim() || !listing.category || !listing.condition.trim() || (listing.category === '教材' && !listing.author?.trim()) || !Number.isFinite(price) || price <= 0 || !listing.delivery || (isOfflineDelivery && !listing.location.trim()) || !listing.contact.trim()) {
      setError(listing.category === '教材' ? `教材请补充作者或主编、价格、交接方式${isOfflineDelivery ? '、交接地点' : ''}和联系方式。` : `请补充商品名称、分类、成色、价格、交接方式${isOfflineDelivery ? '、交接地点' : ''}和联系方式。`)
      return
    }
    setLoading(true); setError(''); setAlternativeIndex(0)
    try {
      const next = await publishTradeListing({ ...listing, title: listing.title.trim(), condition: listing.condition.trim(), author: listing.author?.trim(), isbn: listing.isbn?.trim(), location: listing.location.trim(), delivery: listing.delivery.trim(), contact: listing.contact.trim(), price })
      setMyListings((current) => [next.primary, ...current.filter((item) => getText(item.id) !== getText(next.primary.id))])
      setShowMyListings(false); setResult(next); setSelected('trade'); setTradeResultRole('seller')
    } catch (reason) { setError(reason instanceof Error ? reason.message : '商品信息暂时无法录入，请稍后重试。') }
    finally { setLoading(false) }
  }

  async function feedback() {
    try { setToast(await sendFeedback()) } catch (reason) { setToast(reason instanceof Error ? reason.message : '反馈未保存。') }
  }

  const isTrade = selected === 'trade'
  const isAll = selected === 'all'
  const isTradeBuyer = isTrade && tradeRole === 'buyer'
  const isBuyerTradeResult = result?.intent === 'trade' && tradeResultRole === 'buyer'
  const hasNoMatch = result?.notice === '没有找到你想要的东西'
  const activeTradeWorkspace = showMyOrders ? 'orders' : showMyListings ? 'listings' : null
  const promptPlaceholder = selected === 'all' ? '一次描述吃饭、取件、自习和二手等多个诉求' : selected === 'trade' ? '' : promptPlaceholders[selected]
  const showResult = loading || Boolean(result && primary)

  return <main className="app-shell" data-theme={theme}>
    <a className="skip-link" href="#assistant">跳到决策输入</a>
    <header className="topbar">
      <div className="brand" aria-label="校园生活决策助手 首页"><span className="brand-mark"><Coffee aria-hidden="true" size={21} /></span><span>校园生活决策助手</span></div>
      <button type="button" className={`theme-toggle ${theme === 'dark' ? 'is-dark' : ''}`} onClick={toggleTheme} aria-label={theme === 'dark' ? '切换至白天模式' : '切换至夜间模式'} aria-pressed={theme === 'dark'}>
        <span className="theme-toggle-sky" aria-hidden="true">{theme === 'dark' ? <><Sparkles className="toggle-star star-one" size={12} /><Sparkles className="toggle-star star-two" size={9} /><i className="toggle-star star-three">✦</i></> : <><Cloud className="toggle-cloud cloud-one" size={20} /><Cloud className="toggle-cloud cloud-two" size={15} /></>}</span>
        <span className="theme-toggle-knob" aria-hidden="true">{theme === 'dark' ? <Moon size={21} fill="currentColor" /> : <Sun size={22} />}</span>
      </button>
    </header>

    {weatherBurst && <ThemeWeatherBurst key={weatherBurst.id} mode={weatherBurst.mode} onComplete={() => setWeatherBurst((current) => current?.id === weatherBurst.id ? null : current)} />}

    <CardFanCarousel cards={heroFanCards} />

    <nav className="scenario-grid" aria-label="决策场景">
      {scenarioInfo.map(({ intent, title, caption, icon: Icon, tone }, index) => <AnimatedCardOption key={intent} index={index} selected={selected === intent} type="button" className={`scenario-card ${tone} ${selected === intent ? 'is-selected' : ''}`} onClick={() => chooseScenario(intent)} aria-pressed={selected === intent}>
        <span className="scenario-icon"><Icon aria-hidden="true" size={23} /></span><span className="scenario-copy"><strong>{title}</strong><small>{caption}</small></span><ChevronRight aria-hidden="true" size={19} />
      </AnimatedCardOption>)}
      <AnimatedCardOption index={4} selected={isAll} centered type="button" className={`scenario-all ${isAll ? 'is-selected' : ''}`} onClick={() => chooseScenario('all')} aria-pressed={isAll} aria-label="多模块联动：一次处理多个校园诉求"><Sparkles aria-hidden="true" size={23} /><strong>多模块<br />联动</strong></AnimatedCardOption>
    </nav>

    <section id="assistant" className={`assistant-panel ${!isTrade || isTradeBuyer ? 'agent-entry-panel' : ''} ${isTrade && activeTradeWorkspace ? 'trade-workspace-open' : ''}`} aria-labelledby="assistant-title">
      <div className={`section-heading ${!isTrade || isTradeBuyer ? 'agent-entry-heading' : ''}`}><div><h2 id="assistant-title">{isTrade ? '二手匹配' : '今天想解决什么？'}</h2>{(!isTrade || isTradeBuyer) && <p className="agent-entry-description">{isTradeBuyer ? '已接入二手教材智能体，可直接查询卖家、版本、ISBN 与发布参考价。' : '已接入校园生活智能体，可直接提问餐饮、快递、空闲教室、二手教材和路线规划。'}</p>}</div>{isTrade && tradeRole === 'seller' ? <button type="button" className="my-listings-button" onClick={() => toggleTradeWorkspace('seller')} aria-expanded={showMyListings} aria-controls="my-listings-panel"><Store aria-hidden="true" size={16} />我的商品{myListings.length > 0 && <b>{myListings.length}</b>}</button> : null}</div>
      {isTrade ? <>
        <div className="trade-role-picker" role="group" aria-label="选择二手交易身份">
          <AnimatedCardOption index={0} selected={tradeRole === 'buyer'} type="button" className={tradeRole === 'buyer' ? 'is-active' : ''} aria-pressed={tradeRole === 'buyer'} onClick={() => selectTradeRole('buyer')}><span>我是买家</span><small>打开教材智能体快速决策</small></AnimatedCardOption>
          <AnimatedCardOption index={1} selected={tradeRole === 'seller'} type="button" className={tradeRole === 'seller' ? 'is-active' : ''} aria-pressed={tradeRole === 'seller'} onClick={() => selectTradeRole('seller')}><span>我是卖家</span><small>录入一件二手商品</small></AnimatedCardOption>
        </div>
        {tradeRole === 'buyer' ? usedBookAgentUrl ? <a className="agent-entry-button" href={usedBookAgentUrl} target="_blank" rel="noreferrer" aria-label="开始二手教材决策，在新标签页打开二手教材智能体">
          <span className="agent-entry-button-copy"><b>开始二手教材决策</b><small>进入元景智能体</small></span><ExternalLink aria-hidden="true" size={20} />
        </a> : <button className="agent-entry-button is-unconfigured" type="button" disabled title="请先配置 VITE_USED_BOOK_AGENT_URL">
          <span className="agent-entry-button-copy"><b>尚未配置二手教材智能体</b><small>请在 .env 中填写入口地址</small></span>
        </button> : <>{showMyListings && <aside id="my-listings-panel" className="my-listings-panel trade-record-panel" aria-label="我的待售商品"><div><strong>我的商品</strong><span>{myListings.length} 件待售</span></div><button type="button" onClick={exitTradeWorkspace} aria-label="退出商品查看，重新选择买卖身份" title="退出商品查看"><X aria-hidden="true" size={18} /></button>{myListings.length ? <ul>{myListings.map((item) => <li key={getText(item.id)}><div><b>{getText(item.title)}</b><span>{getText(item.condition)} · {getText(item.delivery)}{getText(item.location) ? ` · ${getText(item.location)}` : ''}</span></div><strong>¥{getText(item.price)}</strong></li>)}</ul> : <p>还没有录入商品；完成发布后会集中显示在这里。</p>}</aside>}<form className="trade-listing-form" onSubmit={(event: FormEvent) => { event.preventDefault(); void submitListing() }}>
          <label><span>商品名称</span><input value={listing.title} onChange={(event) => setListing({ ...listing, title: event.target.value })} placeholder="例如：高等数学第七版上册" disabled={loading} /></label>
          <label><span>商品分类</span><select value={listing.category} onChange={(event) => setListing({ ...listing, category: event.target.value })} disabled={loading}><option value="" disabled>请选择分类</option><option value="教材">教材</option><option value="数码">数码</option><option value="生活用品">生活用品</option><option value="其他">其他</option></select></label>
          <label className="listing-image-field field-wide"><span>商品图片 <small id="listing-image-help">可选，最多 6 张；单张不超过 3MB</small></span><span className="listing-image-grid" aria-describedby="listing-image-help">{listing.imageUrls.map((imageUrl, index) => <span className="listing-image-preview" key={imageUrl}><img src={imageUrl} alt={`商品图片 ${index + 1}`} /><button type="button" onClick={(event) => { event.preventDefault(); removeListingImage(index) }} disabled={loading} aria-label={`删除商品图片 ${index + 1}`}><X aria-hidden="true" size={15} /></button></span>)}{listing.imageUrls.length < maxListingImages && <span className="listing-image-add"><ImagePlus aria-hidden="true" size={21} /><b>添加图片</b><small>{listing.imageUrls.length}/{maxListingImages}</small><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => void addListingImages(event)} disabled={loading} /></span>}</span></label>
          <label className="field-wide"><span>商品成色</span><input value={listing.condition} onChange={(event) => setListing({ ...listing, condition: event.target.value })} placeholder="例如：九成新，有少量笔记" disabled={loading} /></label>
          {listing.category === '教材' && <div className="book-detail-fields"><label><span>作者（主编）</span><input value={listing.author ?? ''} onChange={(event) => setListing({ ...listing, author: event.target.value })} placeholder="例如：同济大学数学系" disabled={loading} /></label><label><span>书号（选填）</span><input value={listing.isbn ?? ''} onChange={(event) => setListing({ ...listing, isbn: event.target.value })} placeholder="例如：978-7-04-039662-8" disabled={loading} /></label></div>}
          <label><span>价格（元）</span><input type="number" min="1" step="0.01" value={listing.price} onChange={(event) => setListing({ ...listing, price: event.target.value })} placeholder="输入价格" disabled={loading} /></label>
          <label className="field-wide"><span>交接方式</span><select value={listing.delivery} onChange={(event) => setListing({ ...listing, delivery: event.target.value, location: event.target.value === '线上' ? '' : listing.location })} disabled={loading}><option value="" disabled>请选择交接方式</option><option value="线上">线上</option><option value="线下">线下</option></select></label>
          {listing.delivery === '线下' && <label><span>交接地点</span><input value={listing.location} onChange={(event) => setListing({ ...listing, location: event.target.value })} placeholder="例如：西区图书馆" disabled={loading} /></label>}
          {listing.delivery && <label className={listing.delivery === '线上' ? 'field-wide' : ''}><span>联系方式</span><input value={listing.contact} onChange={(event) => setListing({ ...listing, contact: event.target.value })} placeholder="例如：138 0000 1234 或微信号" disabled={loading} /></label>}
          <AnimatedActionButton className="submit-button trade-publish-button" type="submit" disabled={loading}>{loading ? <span className="spinner" /> : <><span>录入演示商品</span><Send aria-hidden="true" size={18} /></>}</AnimatedActionButton>
        </form></>}
      </> : maasAgentUrl ? <a className="agent-entry-button" href={maasAgentUrl} target="_blank" rel="noreferrer" aria-label="开始决策，在新标签页打开校园生活智能体">
        <span className="agent-entry-button-copy"><b>开始决策</b><small>进入校园生活智能体</small></span><ExternalLink aria-hidden="true" size={20} />
      </a> : <button className="agent-entry-button is-unconfigured" type="button" disabled title="请先配置 VITE_PRIMARY_AGENT_URL">
        <span className="agent-entry-button-copy"><b>尚未配置智能体入口</b><small>请在 .env 中填写入口地址</small></span>
      </button>}
      {error && <div className="error-message" role="alert"><CircleHelp aria-hidden="true" size={18} />{error}<button onClick={() => setError('')} aria-label="关闭提示"><X size={17} /></button></div>}
    </section>

    <section className={`result-section ${showResult ? '' : 'is-idle'}`} aria-live="polite" aria-busy={loading}>
      {showResult ? <><div className="section-heading"><div><p className="eyebrow">{tradeResultRole === 'seller' ? '演示商品已录入' : hasNoMatch ? '系统推荐' : isBuyerTradeResult ? '为你筛选到' : result?.intent === 'all' ? '四个知识库已联动' : result?.intent === 'meal' ? '为你挑好了' : '决策建议'}</p><h2>{loading ? '正在核对条件…' : tradeResultRole === 'seller' ? '你的商品已发布' : hasNoMatch ? '没有找到你想要的东西' : isBuyerTradeResult && result ? `筛选到 ${result.alternatives.length + 1} 条二手商品` : result?.intent === 'all' ? '多诉求行动方案' : result?.intent === 'meal' ? '这份很适合你' : getText(primary?.title)}</h2></div>{result && <div className="source-badge">{result.mode === 'mock' ? '演示数据' : 'MaaS 结果'} · 刚刚更新</div>}</div>
      {loading ? <LoadingCard /> : result && primary ? result.mode === 'maas' ? <MaaSAnswerCard result={result} item={primary} onFeedback={() => void feedback()} /> : result.intent === 'all' ? <MultiResultCard result={result} item={primary} onFeedback={() => void feedback()} /> : isBuyerTradeResult ? <TradeMatchResults result={result} items={hasNoMatch ? result.alternatives : [primary, ...result.alternatives]} noMatch={hasNoMatch} onRevealContact={(item) => { setMyOrders((current) => [item, ...current.filter((order) => getText(item.id) !== getText(order.id))]); setToast(`已显示“${getText(item.title)}”的卖家联系方式，可直接联系。`) }} /> : <ResultCard result={result} item={primary} tradeRole={tradeResultRole} onAlternative={() => setAlternativeIndex((alternativeIndex + 1) % (result.alternatives.length + 1))} onEditTrade={() => { setResult(null); setTradeResultRole(null); setTradeRole('seller') }} onFeedback={() => void feedback()} /> : null}</> : <article className="decision-placeholder"><div className="decision-placeholder-icon"><ShieldCheck aria-hidden="true" size={22} /></div><div><p>校园生活决策助手</p><h2>重视你的每一个决策</h2><span>把需求输入到快速开始，筛选结果会在这里清楚呈现。</span></div></article>}
    </section>

    <button type="button" className={`more-content-toggle ${showMoreContent ? 'is-open' : ''}`} onClick={() => setShowMoreContent((visible) => !visible)} aria-expanded={showMoreContent} aria-controls="more-campus-content"><span>更多内容</span><ChevronDown aria-hidden="true" size={19} /></button>
    <AnimatePresence initial={false}>
    {showMoreContent && <motion.div id="more-campus-content" className="more-campus-content" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.24, ease: 'easeOut' }}>
    <section className="campus-news" aria-labelledby="campus-news-title">
      <div className="news-heading"><div><p className="eyebrow"><Newspaper aria-hidden="true" size={16} />校园资讯</p><h2 id="campus-news-title">校园新闻</h2></div><span className="publisher-badge"><Megaphone aria-hidden="true" size={15} />{newsQuery || newsFilter !== '全部' ? `匹配 ${filteredCampusNews.length} 条` : `校方发布 · ${managedContent.news.length} 条`}</span></div>
      <div className="news-search"><Search aria-hidden="true" size={18} /><label className="sr-only" htmlFor="news-search">搜索校园新闻</label><input id="news-search" type="search" value={newsQuery} onChange={(event) => setNewsQuery(event.target.value)} placeholder="搜索新闻标题、分类或关键词" /></div>
      <div className="news-filter-bar" role="group" aria-label="新闻标签筛选">
        {newsFilters.map((filter, index) => <AnimatedCardOption key={filter} index={index} selected={newsFilter === filter} type="button" className={newsFilter === filter ? 'is-active' : ''} aria-pressed={newsFilter === filter} onClick={() => { setNewsFilter(filter); setOpenNewsId(null) }}>{filter}</AnimatedCardOption>)}
      </div>
      <div className="news-list" role="region" aria-label="校园新闻列表，可上下滚动查看其他新闻" aria-describedby="news-scroll-hint" tabIndex={0}>
        {filteredCampusNews.length ? filteredCampusNews.map((news) => {
          const isOpen = openNewsId === news.id
          return <motion.article layout="position" className="news-item" key={news.id} animate={{ scale: isOpen ? 1.008 : 1 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }}>
            <div className="news-icon"><Megaphone aria-hidden="true" size={20} /></div>
            <div className="news-copy"><div className="news-meta"><span>{news.category}</span><time dateTime={`2026-${news.date.replace(' 月 ', '-').replace(' 日', '')}`}>{news.date}</time></div><h3>{news.title}</h3><p>{news.summary}</p><AnimatePresence initial={false}>{isOpen && <motion.div className="news-expanded" initial={{ height: 0, opacity: 0, y: -6 }} animate={{ height: 'auto', opacity: 1, y: 0 }} exit={{ height: 0, opacity: 0, y: -6 }} transition={{ duration: 0.2, ease: 'easeOut' }}><p className="news-details">{news.details}</p><p className="news-source"><b>文章出处</b><span>{news.source?.trim() || '暂未标注'}</span></p></motion.div>}</AnimatePresence></div>
            <button type="button" className="news-toggle" onClick={() => setOpenNewsId(isOpen ? null : news.id)} aria-expanded={isOpen} aria-label={`${isOpen ? '收起' : '展开'} ${news.title}详情`}>{isOpen ? '收起' : '详情'}<ChevronRight aria-hidden="true" size={17} /></button>
          </motion.article>
        }) : <p className="news-empty">没有找到相关校园新闻，试试其他关键词。</p>}
      </div>
      <p className="news-note"><CalendarDays aria-hidden="true" size={15} />演示内容 · 正式发布请以校方公告为准<span id="news-scroll-hint" className="news-scroll-hint"><ChevronDown aria-hidden="true" size={15} />向上滑动查看更多</span></p>
    </section>

    <section className="hqu-resource-nav" aria-labelledby="hqu-resource-title">
      <div className="hqu-resource-heading"><div><p className="eyebrow">校园资源</p><h2 id="hqu-resource-title">校园相关网站</h2></div><span>模拟导航</span></div>
      <nav className="hqu-link-grid" aria-label="校园相关网站模拟导航">
        {managedContent.siteLinks.map((link) => { const Icon = siteIconFor(link); return <a key={link.id} href={link.url} target="_blank" rel="noreferrer"><span className="hqu-link-icon"><Icon aria-hidden="true" size={19} /></span><span><strong>{link.title}</strong><small>{link.note}</small></span><ExternalLink aria-hidden="true" size={16} /></a> })}
      </nav>
    </section>
    </motion.div>}
    </AnimatePresence>
    <footer className="site-footer"><span>校园生活决策助手</span><span>相关网站均为模拟数据</span></footer>
    {toast && <div className="toast" role="status"><CheckCircle2 aria-hidden="true" size={19} />{toast}</div>}
  </main>
}

function ThemeWeatherBurst({ mode, onComplete }: { mode: ThemeMode; onComplete: () => void }) {
  const particles = mode === 'dark'
    ? [{ x: -54, y: -48, midX: 14, midY: -30, delay: 0.04, scale: 1 }, { x: -132, y: -24, midX: -8, midY: -48, delay: 0.12, scale: 0.78 }, { x: -96, y: 42, midX: 21, midY: 12, delay: 0.2, scale: 0.9 }, { x: -185, y: 25, midX: -46, midY: -12, delay: 0.08, scale: 0.62 }, { x: -210, y: -62, midX: -22, midY: -60, delay: 0.24, scale: 0.7 }]
    : [{ x: -70, y: 7, midX: 8, midY: -18, delay: 0.04, scale: 1 }, { x: -145, y: -32, midX: -10, midY: 16, delay: 0.13, scale: 0.8 }, { x: -190, y: 24, midX: 18, midY: -7, delay: 0.21, scale: 1.08 }, { x: -116, y: 54, midX: -30, midY: 11, delay: 0.1, scale: 0.68 }]

  return <motion.div className={`theme-weather-burst ${mode === 'dark' ? 'is-night' : 'is-day'}`} aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }} transition={{ duration: 3.3, times: [0, 0.08, 0.78, 1] }} onAnimationComplete={onComplete}>
    {particles.map((particle, index) => <motion.span className="weather-particle" key={index} initial={{ opacity: 0, x: 0, y: 0, scale: 0.2, rotate: -18 }} animate={{ opacity: [0, 1, 1, 0.2], x: [0, particle.midX, particle.x], y: [0, particle.midY, particle.y], scale: [0.2, particle.scale * 1.1, particle.scale], rotate: [-18, index % 2 ? 22 : -9, index % 2 ? -12 : 18] }} transition={{ duration: 1.45, delay: particle.delay, times: [0, 0.42, 1], ease: [0.16, 1, 0.3, 1] }}>
      <span className="weather-particle-float">{mode === 'dark' ? <FilledFourPointStar size={index === 0 ? 22 : 14} /> : <Cloud size={index === 0 ? 29 : 21} fill="currentColor" />}</span>
    </motion.span>)}
  </motion.div>
}

function FilledFourPointStar({ size }: { size: number }) {
  return <svg className="weather-four-point-star" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 0c.9 7.72 4.28 11.1 12 12-7.72.9-11.1 4.28-12 12-.9-7.72-4.28-11.1-12-12 7.72-.9 11.1-4.28 12-12Z" /></svg>
}

function LoadingCard() { return <div className="loading-card"><div className="skeleton heading" /><div className="skeleton line" /><div className="skeleton line short" /><div className="loading-label"><span className="spinner green-spin" />正在根据时间、距离和偏好计算</div></div> }

function MultiResultCard({ result, item, onFeedback }: { result: Decision; item: Record<string, unknown>; onFeedback: () => void }) {
  const [openModuleId, setOpenModuleId] = useState<string | null>(null)
  const noMatch = result.notice === '没有找到你想要的东西'
  const modules = Array.isArray(item.modules) ? item.modules.filter((module): module is Record<string, unknown> => Boolean(module) && typeof module === 'object') : []
  const iconFor = (id: string) => id === 'meal' ? <UtensilsCrossed aria-hidden="true" /> : id === 'parcel' ? <PackageCheck aria-hidden="true" /> : id === 'study' ? <BookOpen aria-hidden="true" /> : <Store aria-hidden="true" />
  return <article className="result-card result-all">
    <div className="result-top"><div className="result-mark"><Sparkles aria-hidden="true" /></div><div className="result-title"><span>{noMatch ? '系统推荐' : '多模块联动'}</span><h3>{getText(item.title)}</h3></div><strong className="multi-count">{modules.length} 类{noMatch ? '推荐' : '回应'}</strong></div>
    <p className="multi-summary">{getText(item.summary)}</p>
    <div className="multi-module-grid">{modules.map((module) => {
      const moduleId = getText(module.id)
      const isOpen = openModuleId === moduleId
      return <article className={`multi-module ${isOpen ? 'is-open' : ''}`} key={moduleId}><button type="button" className="multi-module-toggle" onClick={() => setOpenModuleId(isOpen ? null : moduleId)} aria-expanded={isOpen} aria-controls={`module-detail-${moduleId}`}><span className={`multi-module-icon ${moduleId}`}>{iconFor(moduleId)}</span><div><small>{getText(module.label)}</small><strong>{getText(module.title)}</strong><p>{getText(module.detail)}</p></div><ChevronDown aria-hidden="true" size={18} /></button><AnimatePresence initial={false}>{isOpen && <motion.ul id={`module-detail-${moduleId}`} className="multi-module-details" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }}>{list(module.details).map((detail, index) => <motion.li key={detail} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.04 }}>{detail}</motion.li>)}</motion.ul>}</AnimatePresence></article>
    })}</div>
    <div className="why"><Sparkles aria-hidden="true" size={18} /><div><strong>{noMatch ? '系统说明' : '联动建议'}</strong><p>{getText(item.reason)}</p></div></div>
    <p className="notice"><ShieldCheck aria-hidden="true" size={16} />{getText(item.safety)}</p>
    <div className="result-actions"><span /><button type="button" className="feedback" onClick={onFeedback}><ThumbsUp aria-hidden="true" size={17} />有帮助</button><button type="button" className="feedback" onClick={onFeedback} aria-label="联动结果不符合预期"><ThumbsDown aria-hidden="true" size={17} /></button></div>
    <div className="result-footer">数据来源：{result.dataSource}　·　可信度 {Math.round(result.confidence * 100)}%　·　{new Date(result.generatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</div>
  </article>
}

function TradeMatchResults({ result, items, noMatch, onRevealContact }: { result: Decision; items: Array<Record<string, unknown>>; noMatch: boolean; onRevealContact: (item: Record<string, unknown>) => void }) {
  const [revealedContacts, setRevealedContacts] = useState<string[]>([])
  return <article className="trade-match-results">
    {noMatch ? <div className="trade-no-match"><Search aria-hidden="true" size={19} /><div><strong>没有找到你想要的东西</strong><p>下面是系统根据当前演示库整理的推荐商品，你也可以换个关键词再试。</p></div></div> : <p className="trade-match-summary">已按你的描述整理相近商品。可上下滑动比较商品信息，选中后直接获取卖家填写的联系方式。</p>}
    {noMatch && <p className="trade-match-summary system-recommendation-label">系统推荐</p>}
    <div className="trade-match-list" role="region" aria-label="二手商品筛选结果，可上下滚动查看其他商品" tabIndex={0}>
      {items.map((item, index) => {
        const id = getText(item.id)
        const isContactRevealed = revealedContacts.includes(id)
        const isOffline = getText(item.delivery) === '线下'
        return <article className="trade-match-item" key={id}>
          <div className="trade-match-top"><div><span>{noMatch ? '系统推荐' : index === 0 ? '优先匹配' : '相似商品'}</span><h3>{getText(item.title)}</h3><p>{getText(item.category)} · {getText(item.freshness)}</p></div><strong className="price">¥{getText(item.price)}</strong></div>
          <ListingImageGallery imageUrls={list(item.imageUrls)} itemTitle={getText(item.title)} />
          <dl className="trade-listing-details"><div><dt>商品成色</dt><dd>{getText(item.condition)}</dd></div>{getText(item.author) && <div><dt>作者（主编）</dt><dd>{getText(item.author)}</dd></div>}{getText(item.isbn) && <div><dt>书号</dt><dd>{getText(item.isbn)}</dd></div>}<div><dt>交接方式</dt><dd>{getText(item.delivery)}</dd></div>{isOffline && <div><dt>交接地点</dt><dd>{getText(item.location)}</dd></div>}</dl>
          <p className="trade-match-reason"><Sparkles aria-hidden="true" size={16} />{getText(item.reason)}</p>
          <div className="trade-contact-row">{isContactRevealed ? <p><span>卖家联系方式</span>{getText(item.contact)}</p> : <button type="button" onClick={() => { setRevealedContacts([...revealedContacts, id]); onRevealContact(item) }}><Send aria-hidden="true" size={16} />获取卖家联系方式</button>}</div>
        </article>
      })}
    </div>
    <p className="notice"><ShieldCheck aria-hidden="true" size={16} />商品与联系方式均为演示数据；联系前请核对商品信息，线下交接请选公共地点。</p>
    <div className="result-footer">数据来源：{result.dataSource}　·　匹配结果 {items.length} 条　·　{new Date(result.generatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</div>
  </article>
}

function ListingImageGallery({ imageUrls, itemTitle }: { imageUrls: string[]; itemTitle: string }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const closeLightbox = () => setActiveIndex(null)
  const moveImage = (offset: number) => setActiveIndex((current) => current === null ? 0 : (current + offset + imageUrls.length) % imageUrls.length)

  useEffect(() => {
    if (activeIndex === null) return
    const previousOverflow = document.body.style.overflow
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeLightbox()
      if (imageUrls.length > 1 && event.key === 'ArrowLeft') moveImage(-1)
      if (imageUrls.length > 1 && event.key === 'ArrowRight') moveImage(1)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onKeyDown) }
  }, [activeIndex, imageUrls.length])

  if (!imageUrls.length) return null
  const currentIndex = activeIndex === null ? 0 : Math.min(activeIndex, imageUrls.length - 1)
  return <><div className="trade-image-gallery" aria-label={`${itemTitle}的商品图片`}>{imageUrls.map((imageUrl, index) => <button type="button" className="trade-image-thumb" onClick={() => setActiveIndex(index)} aria-label={`放大查看 ${itemTitle} 的第 ${index + 1} 张图片`} key={imageUrl}><img src={imageUrl} alt={`${itemTitle} 商品图片 ${index + 1}`} loading="lazy" /></button>)}</div><p className="trade-image-hint">点击图片查看大图</p><AnimatePresence>{activeIndex !== null && <motion.div className="trade-image-lightbox" role="presentation" onMouseDown={closeLightbox} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.section className="trade-image-dialog" role="dialog" aria-modal="true" aria-label={`${itemTitle} 图片查看器`} onMouseDown={(event) => event.stopPropagation()} initial={{ scale: .96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: .96, y: 10 }} transition={{ duration: .18, ease: 'easeOut' }}><button type="button" className="lightbox-close" onClick={closeLightbox} aria-label="关闭大图"><X aria-hidden="true" size={19} /></button>{imageUrls.length > 1 && <button type="button" className="lightbox-nav previous" onClick={() => moveImage(-1)} aria-label="查看上一张图片"><ChevronLeft aria-hidden="true" size={24} /></button>}<img src={imageUrls[currentIndex]} alt={`${itemTitle} 商品图片 ${currentIndex + 1}（大图）`} />{imageUrls.length > 1 && <button type="button" className="lightbox-nav next" onClick={() => moveImage(1)} aria-label="查看下一张图片"><ChevronRight aria-hidden="true" size={24} /></button>}<span className="lightbox-count">{currentIndex + 1} / {imageUrls.length}</span></motion.section></motion.div>}</AnimatePresence></>
}

function MaaSAnswerCard({ result, item, onFeedback }: { result: Decision; item: Record<string, unknown>; onFeedback: () => void }) {
  return <article className="result-card result-maas">
    <div className="result-top"><div className="result-mark"><Sparkles aria-hidden="true" /></div><div className="result-title"><span>知识库问答</span><h3>{getText(item.title)}</h3></div></div>
    <div className="maas-answer">{getText(item.answer)}</div>
    <p className="notice"><ShieldCheck aria-hidden="true" size={16} />回答仅依据当前已接入的校园知识库；实时状态请以现场或官方渠道为准。</p>
    <div className="result-actions"><span /><button type="button" className="feedback" onClick={onFeedback}><ThumbsUp aria-hidden="true" size={17} />有帮助</button><button type="button" className="feedback" onClick={onFeedback} aria-label="回答不准确"><ThumbsDown aria-hidden="true" size={17} /></button></div>
    <div className="result-footer">数据来源：{result.dataSource}　·　{new Date(result.generatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</div>
  </article>
}

function ResultCard({ result, item, tradeRole, onAlternative, onEditTrade, onFeedback }: { result: Decision; item: Record<string, unknown>; tradeRole: TradeRole | null; onAlternative: () => void; onEditTrade: () => void; onFeedback: () => void }) {
  const intent = result.intent
  const isSellerListing = intent === 'trade' && tradeRole === 'seller'
  const fields = intent === 'meal'
    ? [[<MapPin />, `${getText(item.canteen)} · ${getText(item.window)}`], [<Clock3 />, `步行 ${getText(item.walkMinutes)} 分钟 · 排队 ${getText(item.queueMinutes)} 分钟`], [<Compass />, `约 ${getText(item.totalMinutes)} 分钟可完成`]]
    : intent === 'parcel'
      ? [[<Navigation />, getText(item.totalDistance)], [<Clock3 />, `预计 ${getText(item.totalMinutes)} 分钟`], [<MapPin />, '校园坐标路线估算']]
      : intent === 'study'
        ? [[<MapPin />, `${getText(item.building)} · ${getText(item.room)}`], [<Clock3 />, getText(item.freeWindow)], [<Compass />, `步行 ${getText(item.walkMinutes)} 分钟`]]
        : [[<MapPin />, getText(item.location)], [<Clock3 />, getText(item.freshness)], [<Compass />, getText(item.delivery)]]
  const price = item.price ? `¥${getText(item.price)}` : null
  const imageUrls = intent === 'trade' ? list(item.imageUrls) : []
  return <article className={`result-card result-${intent}`}>
    <div className="result-top"><div className="result-mark">{intent === 'meal' ? <UtensilsCrossed aria-hidden="true" /> : intent === 'parcel' ? <Navigation aria-hidden="true" /> : intent === 'study' ? <BookOpen aria-hidden="true" /> : <Store aria-hidden="true" />}</div><div className="result-title"><span>{isSellerListing ? '已录入' : intent === 'meal' ? '首选推荐' : intent === 'trade' ? '匹配结果' : '首选方案'}</span><h3>{getText(item.title)}</h3></div>{price && <strong className="price">{price}</strong>}</div>
    <div className="metrics">{fields.map(([icon, text], index) => <span key={index}>{icon}{text}</span>)}</div>
    {intent === 'trade' && <ListingImageGallery imageUrls={imageUrls} itemTitle={getText(item.title)} />}
    {intent === 'parcel' && <div className="route-map" aria-label="校园路线示意图"><span className="map-stop start">图书馆</span><i /><span className="map-stop mid">东门丰巢</span><i /><span className="map-stop end">菜鸟驿站</span></div>}
    {intent === 'study' && <div className="chips">{list(item.facilities).map((label) => <span key={label}>{label}</span>)}<span>{getText(item.confidenceLabel)}</span></div>}
    {intent === 'meal' && <div className="chips">{list(item.tags).map((label) => <span key={label}>{label}</span>)}</div>}
    {intent === 'trade' && (Boolean(getText(item.author)) || Boolean(getText(item.isbn)) || isSellerListing) && <div className="chips">{getText(item.author) && <span>作者：{getText(item.author)}</span>}{getText(item.isbn) && <span>书号：{getText(item.isbn)}</span>}{isSellerListing && <span>联系方式已录入</span>}</div>}
    <div className="why"><Sparkles aria-hidden="true" size={18} /><div><strong>为什么推荐</strong><p>{getText(item.reason)}</p></div></div>
    {Boolean(item.risk || item.safety) && <p className="notice"><ShieldCheck aria-hidden="true" size={16} />{getText(item.risk ?? item.safety)}</p>}
    <div className="result-actions"><button type="button" className="text-action" onClick={isSellerListing ? onEditTrade : onAlternative}><RefreshCcw aria-hidden="true" size={17} />{isSellerListing ? '编辑商品' : '换一个'}</button><button type="button" className="text-action" onClick={() => document.querySelector(intent === 'parcel' ? '.route-map' : '.result-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}><MapPin aria-hidden="true" size={17} />{intent === 'trade' ? '交接提醒' : '查看路线'}</button><span /><button type="button" className="feedback" onClick={onFeedback}><ThumbsUp aria-hidden="true" size={17} />有帮助</button><button type="button" className="feedback" onClick={onFeedback} aria-label="排队比预计久"><ThumbsDown aria-hidden="true" size={17} /></button></div>
    <div className="result-footer">数据来源：{result.dataSource}　·　可信度 {Math.round(result.confidence * 100)}%　·　{new Date(result.generatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</div>
  </article>
}

export default App
