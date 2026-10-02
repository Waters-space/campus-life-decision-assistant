import {
  ChangeEvent,
  type CSSProperties,
  FormEvent,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  FileImage,
  KeyRound,
  Link2,
  LogOut,
  Newspaper,
  Paintbrush,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import {
  fallbackContent,
  templateDecorationForTone,
  type CampusNews,
  type CampusSiteLink,
  type HeroOverlay,
  type HeroPhoto,
  type HeroTemplateElement,
  type HeroTemplateStyle,
  type ManagedContent,
} from "./content";
import "./admin.css";
import "./admin-overrides.css";

type AdminStatus = { configured: boolean; authenticated: boolean };
type Tab = "photos" | "news" | "links";
type AuthMode = "login" | "register";
type TemplateTone = "start" | "filter" | "explain";
type OverlayShape = NonNullable<HeroOverlay["shape"]>;
type CropDraft = { index: number; src: string; alt: string };

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const newId = (prefix: string) => `${prefix}-${Date.now()}`;
const blankOverlay = (kind: HeroOverlay["kind"]): HeroOverlay => ({
  id: newId(kind),
  kind,
  text: kind === "image" ? "外部贴图" : kind === "sticker" ? "" : "新文字",
  x: kind === "sticker" ? 52 : kind === "image" ? 52 : 10,
  y: kind === "sticker" ? 64 : kind === "image" ? 64 : 64,
  fontSize: 18,
  fontFamily: "sans",
  color: "#3b241b",
  ...(kind === "sticker" ? { shape: "pill" as OverlayShape, background: "#fff8e7", size: 92 } : {}),
  ...(kind === "image" ? { imageUrl: "", size: 86 } : {}),
});
const pointsToAdmin = (url: string) => {
  try {
    return new URL(url, window.location.origin).pathname === "/admin";
  } catch {
    return false;
  }
};
const blankPhoto = (): HeroPhoto => ({
  id: newId("card"),
  imageUrl: "/hero-cards/hero-start.svg",
  alt: "首屏卡片",
  eyebrow: "校园生活决策助手",
  title: "新的首页，",
  emphasis: "卡片内容。",
  description: "填写这张首屏卡片的说明。",
  trust: "管理员发布内容",
  metricLabel: "首页卡片",
  metricValue: "NEW",
  metricCaption: "待补充",
  routeLabel: "继续浏览",
  routeValue: "下一张",
  signals: ["校园", "卡片"],
  tone: "start",
  showSeal: true,
});
const templateOptions: Array<{
  tone: TemplateTone;
  title: string;
  description: string;
  imageUrl: string;
}> = [
  {
    tone: "start",
    title: "暖阳决策",
    description: "杏橙暖色 · 行动引导",
    imageUrl: "/hero-cards/hero-start.svg",
  },
  {
    tone: "filter",
    title: "清新筛选",
    description: "明亮轻快 · 条件梳理",
    imageUrl: "/hero-cards/hero-filter.svg",
  },
  {
    tone: "explain",
    title: "安心解释",
    description: "理性沉静 · 依据呈现",
    imageUrl: "/hero-cards/hero-explain.svg",
  },
];
const isTemplateTone = (tone: HeroPhoto["tone"]): tone is TemplateTone =>
  tone === "start" || tone === "filter" || tone === "explain";
const templateToneFor = (photo: HeroPhoto): TemplateTone =>
  isTemplateTone(photo.tone) ? photo.tone : "start";
const isImageDisplay = (photo: HeroPhoto) =>
  photo.tone === "photo" || (!photo.tone && Boolean(photo.imageUrl));
const isTemplateContentEnabled = (photo: HeroPhoto) =>
  photo.showTemplateContent ?? isTemplateTone(photo.tone);
const blankNews = (): CampusNews => ({
  id: newId("news"),
  category: "校园资讯",
  title: "新校园新闻",
  summary: "请填写新闻摘要。",
  details: "请填写新闻完整内容。",
  source: "",
  date: "09 月 12 日",
  tags: ["活动通知"],
});
const blankLink = (): CampusSiteLink => ({
  id: newId("link"),
  title: "新校园网站",
  note: "填写网站用途说明",
  url: "https://",
  icon: "landmark",
});

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message ?? "请求失败，请稍后重试。");
  return body as T;
}

function notifyPublicContent(content: ManagedContent) {
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel("campus-managed-content");
    channel.postMessage(content);
    channel.close();
  }
  localStorage.setItem("campus-managed-content-updated", String(Date.now()));
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          placeholder={placeholder}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      )}
    </label>
  );
}

function AdminNotice({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div className="admin-message" role="status">
      <span>{message}</span>
      <button type="button" onClick={onDismiss} aria-label="关闭提示">
        <X size={16} />
      </button>
    </div>
  );
}

function PreviewField({
  className,
  value,
  onChange,
  multiline = false,
  label,
}: {
  className: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  label: string;
}) {
  return multiline ? (
    <textarea
      className={className}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={label}
      rows={2}
    />
  ) : (
    <input
      className={className}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={label}
    />
  );
}

function DraggablePreview({
  slot,
  position,
  onPosition,
  children,
  className,
  onClick,
  style: customStyle,
}: {
  slot: string;
  position?: { x: number; y: number };
  onPosition: (position: { x: number; y: number }) => void;
  children: ReactNode;
  className: string;
  onClick?: () => void;
  style?: CSSProperties;
}) {
  const elementRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const clamp = (value: number) => Math.min(94, Math.max(-6, value));
  const startDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const element = elementRef.current;
    const parent = element?.parentElement;
    if (!element || !parent) return;
    const elementRect = element.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: ((elementRect.left - parentRect.left) / parentRect.width) * 100,
      top: ((elementRect.top - parentRect.top) / parentRect.height) * 100,
      width: parentRect.width,
      height: parentRect.height,
    };
    element.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    onPosition({
      x: clamp(drag.left + ((event.clientX - drag.x) / drag.width) * 100),
      y: clamp(drag.top + ((event.clientY - drag.y) / drag.height) * 100),
    });
  };
  const stopDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };
  const style = position
    ? {
        left: `${position.x}%`,
        top: `${position.y}%`,
        right: "auto",
        bottom: "auto",
      }
    : {};
  return (
    <div
      ref={elementRef}
      className={`preview-draggable ${className}`}
      data-slot={slot}
      style={{ ...style, ...customStyle }}
      onPointerMove={moveDrag}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      onClick={onClick}
    >
      <button
        className="preview-drag-handle"
        type="button"
        onPointerDown={startDrag}
        aria-label={`拖动${slot}的位置`}
        title="拖动调整位置"
      >
        ⠿
      </button>
      {children}
    </div>
  );
}

function TemplateLivePreview({
  photo,
  onChange,
}: {
  photo: HeroPhoto;
  onChange: (patch: Partial<HeroPhoto>) => void;
}) {
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [editingOverlayId, setEditingOverlayId] = useState<string | null>(null);
  const [editingTemplateElement, setEditingTemplateElement] = useState<HeroTemplateElement | null>(null);
  const stickerInputRef = useRef<HTMLInputElement>(null);
  const template = templateOptions.find(
    (item) => item.tone === templateToneFor(photo),
  )!;
  const overlays = photo.overlays ?? [];
  const templateDecoration = templateDecorationForTone(template.tone);
  const hiddenTemplateElements = photo.hiddenTemplateElements ?? [];
  const templateElementNames: Record<HeroTemplateElement, string> = { eyebrow: "导语", headline: "标题", description: "说明", trust: "提示语", seal: "校徽" };
  const isTemplateVisible = (element: HeroTemplateElement) => !hiddenTemplateElements.includes(element);
  const updateOverlay = (id: string, patch: Partial<HeroOverlay>) => {
    onChange({ overlays: overlays.map((item) => item.id === id ? { ...item, ...patch } : item) });
  };
  const updateTemplateStyle = (element: HeroTemplateElement, patch: HeroTemplateStyle) => {
    onChange({ templateStyles: { ...photo.templateStyles, [element]: { ...photo.templateStyles?.[element], ...patch } } });
  };
  const templatePreviewStyle = (element: Exclude<HeroTemplateElement, "seal">): CSSProperties => {
    const style = photo.templateStyles?.[element];
    return { "--template-font-size": style?.fontSize ? `${style.fontSize}px` : undefined, "--template-font-family": style?.fontFamily === "serif" ? 'Georgia, "Songti SC", serif' : style?.fontFamily === "rounded" ? '"Arial Rounded MT Bold", "Microsoft YaHei", sans-serif' : style?.fontFamily === "handwriting" ? '"KaiTi", "STKaiti", cursive' : style?.fontFamily === "sans" ? '"Microsoft YaHei", "PingFang SC", sans-serif' : undefined, "--template-color": style?.color } as CSSProperties;
  };
  const openTemplateEditor = (element: HeroTemplateElement) => {
    setEditingTemplateElement(element);
    setEditingOverlayId(null);
  };
  const hideTemplateElement = (element: HeroTemplateElement) => {
    onChange({ hiddenTemplateElements: [...new Set([...hiddenTemplateElements, element])] });
    if (editingTemplateElement === element) setEditingTemplateElement(null);
  };
  const restoreTemplateElement = (element: HeroTemplateElement) => {
    onChange({ hiddenTemplateElements: hiddenTemplateElements.filter((item) => item !== element) });
  };
  const TemplateControls = ({ element }: { element: HeroTemplateElement }) => <>
    <button type="button" className="preview-template-edit" onClick={(event) => { event.stopPropagation(); openTemplateEditor(element); }} aria-label={`编辑${templateElementNames[element]}样式`} title={`编辑${templateElementNames[element]}`}><Paintbrush size={14} /></button>
    <button type="button" className="preview-template-remove" onClick={(event) => { event.stopPropagation(); hideTemplateElement(element); }} aria-label={`删除${templateElementNames[element]}`} title={`删除${templateElementNames[element]}`}>×</button>
  </>;
  const overlayPreviewStyle = (overlay: HeroOverlay): CSSProperties => ({
    ...(overlay.kind === "text" ? { color: overlay.color, fontSize: `${overlay.fontSize}px`, fontFamily: overlay.fontFamily === "serif" ? 'Georgia, "Songti SC", serif' : overlay.fontFamily === "rounded" ? '"Arial Rounded MT Bold", "Microsoft YaHei", sans-serif' : overlay.fontFamily === "handwriting" ? '"KaiTi", "STKaiti", cursive' : '"Microsoft YaHei", "PingFang SC", sans-serif' } : {}),
    ...(overlay.kind === "sticker" ? { "--overlay-size": `${overlay.size ?? 92}px`, "--overlay-background": overlay.background ?? "#fff8e7" } : {}),
    ...(overlay.kind === "image" ? { "--overlay-size": `${overlay.size ?? 86}px` } : {}),
  } as CSSProperties);
  const addOverlay = (kind: HeroOverlay["kind"]) => {
    const overlay = blankOverlay(kind);
    onChange({ overlays: [...overlays, overlay] });
    setSelectedOverlayId(overlay.id);
    setEditingOverlayId(kind === "image" ? null : overlay.id);
    setEditingTemplateElement(null);
  };
  const removeOverlay = (id: string) => {
    onChange({ overlays: overlays.filter((item) => item.id !== id) });
    setSelectedOverlayId(null);
    setEditingOverlayId(null);
  };
  const importSticker = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 3 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => {
      const overlay = { ...blankOverlay("image"), imageUrl: String(reader.result), text: file.name.replace(/\.[^.]+$/, "") || "外部贴图" };
      onChange({ overlays: [...overlays, overlay] });
      setSelectedOverlayId(overlay.id);
    };
    reader.readAsDataURL(file);
  };
  const editingOverlay = overlays.find((item) => item.id === editingOverlayId);
  return (
    <div className="admin-template-editor">
      <div className={`admin-template-preview admin-template-preview--${template.tone}`}>
        <img src={photo.imageUrl || template.imageUrl} alt="当前模板预览" />
        {isTemplateContentEnabled(photo) && <>
        <div className={`preview-template-decoration preview-overlay--sticker preview-overlay--${templateDecoration.shape ?? "circle"}`} style={{ ...overlayPreviewStyle(templateDecoration), left: `${templateDecoration.x}%`, top: `${templateDecoration.y}%` }} aria-hidden="true" />
        {photo.showSeal && isTemplateVisible("seal") && (
          <DraggablePreview
            slot="seal"
            className="preview-seal"
            position={photo.layout?.seal}
            onPosition={(position) => onChange({ layout: { ...photo.layout, seal: position } })}
            style={photo.templateStyles?.seal?.size ? { width: `${photo.templateStyles.seal.size}px` } : undefined}
          >
            <img className="admin-template-seal" src="/hero-cards/site-badge.svg" alt="可拖动的校园标志占位图" />
            <TemplateControls element="seal" />
          </DraggablePreview>
        )}
        {isTemplateVisible("eyebrow") && <DraggablePreview slot="eyebrow" className="preview-eyebrow" position={photo.layout?.eyebrow} onPosition={(position) => onChange({ layout: { ...photo.layout, eyebrow: position } })} style={templatePreviewStyle("eyebrow")}>
          <PreviewField className="preview-text-input" value={photo.eyebrow} onChange={(value) => onChange({ eyebrow: value })} label="导语" />
          <TemplateControls element="eyebrow" />
        </DraggablePreview>}
        {isTemplateVisible("headline") && <DraggablePreview slot="headline" className="preview-headline" position={photo.layout?.headline} onPosition={(position) => onChange({ layout: { ...photo.layout, headline: position } })} style={templatePreviewStyle("headline")}>
          <PreviewField className="preview-title" value={photo.title} onChange={(value) => onChange({ title: value })} label="标题" />
          <PreviewField className="preview-emphasis" value={photo.emphasis} onChange={(value) => onChange({ emphasis: value })} label="强调文字" />
          <TemplateControls element="headline" />
        </DraggablePreview>}
        {isTemplateVisible("description") && <DraggablePreview slot="description" className="preview-description" position={photo.layout?.description} onPosition={(position) => onChange({ layout: { ...photo.layout, description: position } })} style={templatePreviewStyle("description")}>
          <PreviewField className="preview-text-input" value={photo.description} onChange={(value) => onChange({ description: value })} label="模板说明" multiline />
          <TemplateControls element="description" />
        </DraggablePreview>}
        {isTemplateVisible("trust") && <DraggablePreview slot="trust" className="preview-trust" position={photo.layout?.trust} onPosition={(position) => onChange({ layout: { ...photo.layout, trust: position } })} style={templatePreviewStyle("trust")}>
          <PreviewField className="preview-text-input" value={photo.trust} onChange={(value) => onChange({ trust: value })} label="提示语" />
          <TemplateControls element="trust" />
        </DraggablePreview>}
        </>}
        {overlays.map((overlay) => (
          <DraggablePreview
            key={overlay.id}
            slot={`overlay-${overlay.id}`}
            className={`preview-overlay preview-overlay--${overlay.kind}${overlay.kind === "sticker" ? ` preview-overlay--${overlay.shape ?? "pill"}` : ""}${selectedOverlayId === overlay.id ? " is-selected" : ""}`}
            position={overlay}
            style={overlayPreviewStyle(overlay)}
            onPosition={(position) => updateOverlay(overlay.id, position)}
            onClick={() => setSelectedOverlayId(overlay.id)}
          >
            {overlay.kind === "image" ? <img className="preview-overlay-image" src={overlay.imageUrl} alt={overlay.text || "外部贴图"} /> : overlay.kind === "text" ? <span className="preview-overlay-text">{overlay.text || "写文字"}</span> : null}
            <button type="button" className="preview-overlay-edit" onClick={(event) => { event.stopPropagation(); setSelectedOverlayId(overlay.id); setEditingOverlayId(overlay.id); }} aria-label="编辑文字或图案样式" title="编辑样式"><Paintbrush size={14} /></button>
            <button type="button" className="preview-overlay-remove" onClick={(event) => { event.stopPropagation(); removeOverlay(overlay.id); }} aria-label="删除此文字或图案" title="删除">×</button>
          </DraggablePreview>
        ))}
      </div>
      <div className="preview-overlay-toolbar" aria-label="自定义图层工具">
        <div className="preview-overlay-actions">
          <button type="button" onClick={() => addOverlay("text")}>＋ 添加文字</button>
          <button type="button" onClick={() => addOverlay("sticker")}>✦ 添加图案</button>
          <button type="button" onClick={() => stickerInputRef.current?.click()}>▧ 上传外部贴图</button>
          <input ref={stickerInputRef} className="preview-sticker-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={importSticker} />
        </div>
        {hiddenTemplateElements.length > 0 && <div className="preview-overlay-actions" aria-label="恢复已删除模板元素">
          {hiddenTemplateElements.map((element) => <button key={element} type="button" onClick={() => restoreTemplateElement(element)}>↶ 恢复{templateElementNames[element]}</button>)}
        </div>}
        {editingTemplateElement && (
          <div className="preview-overlay-settings preview-template-settings">
            <strong>编辑模板{templateElementNames[editingTemplateElement]}</strong>
            {editingTemplateElement === "seal" ? <label>校徽大小<input type="range" min="32" max="240" value={photo.templateStyles?.seal?.size ?? 134} onChange={(event) => updateTemplateStyle("seal", { size: Number(event.target.value) })} /><output>{photo.templateStyles?.seal?.size ?? 134}px</output></label> : <><label>字号<input type="range" min="10" max="72" value={photo.templateStyles?.[editingTemplateElement]?.fontSize ?? (editingTemplateElement === "headline" ? 38 : 14)} onChange={(event) => updateTemplateStyle(editingTemplateElement, { fontSize: Number(event.target.value) })} /><output>{photo.templateStyles?.[editingTemplateElement]?.fontSize ?? (editingTemplateElement === "headline" ? 38 : 14)}px</output></label><label>字型<select value={photo.templateStyles?.[editingTemplateElement]?.fontFamily ?? "sans"} onChange={(event) => updateTemplateStyle(editingTemplateElement, { fontFamily: event.target.value as HeroOverlay["fontFamily"] })}><option value="sans">现代无衬线</option><option value="serif">衬线宋体</option><option value="rounded">圆体</option><option value="handwriting">手写楷体</option></select></label><label>文字颜色<input type="color" value={photo.templateStyles?.[editingTemplateElement]?.color ?? (editingTemplateElement === "headline" ? "#c44213" : "#39231b")} onChange={(event) => updateTemplateStyle(editingTemplateElement, { color: event.target.value })} /></label></>}
          </div>
        )}
        {editingOverlay && (
          <div className="preview-overlay-settings">
            {editingOverlay.kind === "text" && <><label>文字<input value={editingOverlay.text} onChange={(event) => updateOverlay(editingOverlay.id, { text: event.target.value })} /></label><label>字号<input type="range" min="10" max="72" value={editingOverlay.fontSize} onChange={(event) => updateOverlay(editingOverlay.id, { fontSize: Number(event.target.value) })} /><output>{editingOverlay.fontSize}px</output></label><label>字型<select value={editingOverlay.fontFamily} onChange={(event) => updateOverlay(editingOverlay.id, { fontFamily: event.target.value as HeroOverlay["fontFamily"] })}><option value="sans">现代无衬线</option><option value="serif">衬线宋体</option><option value="rounded">圆体</option><option value="handwriting">手写楷体</option></select></label><label>文字颜色<input type="color" value={editingOverlay.color} onChange={(event) => updateOverlay(editingOverlay.id, { color: event.target.value })} /></label></>}
            {editingOverlay.kind === "sticker" && <><label>图案<select value={editingOverlay.shape ?? "pill"} onChange={(event) => updateOverlay(editingOverlay.id, { shape: event.target.value as OverlayShape })}><option value="pill">圆角标签</option><option value="circle">圆形</option><option value="star">星形</option><option value="burst">爆炸贴</option><option value="tag">吊牌</option></select></label><label>图案颜色<input type="color" value={editingOverlay.background ?? "#fff8e7"} onChange={(event) => updateOverlay(editingOverlay.id, { background: event.target.value })} /></label><label>图案大小<input type="range" min="32" max="220" value={editingOverlay.size ?? 92} onChange={(event) => updateOverlay(editingOverlay.id, { size: Number(event.target.value) })} /><output>{editingOverlay.size ?? 92}px</output></label></>}
            {editingOverlay.kind === "image" && <><label>贴图名称<input value={editingOverlay.text} onChange={(event) => updateOverlay(editingOverlay.id, { text: event.target.value })} /></label><label>贴图大小<input type="range" min="32" max="220" value={editingOverlay.size ?? 86} onChange={(event) => updateOverlay(editingOverlay.id, { size: Number(event.target.value) })} /><output>{editingOverlay.size ?? 86}px</output></label></>}
            <button type="button" className="preview-overlay-delete" onClick={() => removeOverlay(editingOverlay.id)}>删除此文字/图案</button>
          </div>
        )}
      </div>
    </div>
  );
}

function PhotoCropDialog({ source, onCancel, onConfirm }: { source: string; onCancel: () => void; onConfirm: (imageUrl: string) => void }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [stageSize, setStageSize] = useState(360);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const refreshStageSize = () => setStageSize(stageRef.current?.clientWidth || 360);
  useEffect(() => {
    window.addEventListener("resize", refreshStageSize);
    return () => window.removeEventListener("resize", refreshStageSize);
  }, []);
  const baseScale = naturalSize ? Math.max(stageSize / naturalSize.width, stageSize / naturalSize.height) : 1;
  const scale = baseScale * zoom;
  const renderedWidth = naturalSize ? naturalSize.width * scale : stageSize;
  const renderedHeight = naturalSize ? naturalSize.height * scale : stageSize;
  const maxOffsetX = Math.max(0, (renderedWidth - stageSize) / 2);
  const maxOffsetY = Math.max(0, (renderedHeight - stageSize) / 2);
  const clampOffset = (value: { x: number; y: number }) => ({ x: Math.max(-maxOffsetX, Math.min(maxOffsetX, value.x)), y: Math.max(-maxOffsetY, Math.min(maxOffsetY, value.y)) });
  const updateZoom = (nextZoom: number) => {
    if (!naturalSize) return;
    setZoom(nextZoom);
    const nextScale = baseScale * nextZoom;
    setOffset((current) => ({ x: Math.max(-Math.max(0, (naturalSize!.width * nextScale - stageSize) / 2), Math.min(Math.max(0, (naturalSize!.width * nextScale - stageSize) / 2), current.x)), y: Math.max(-Math.max(0, (naturalSize!.height * nextScale - stageSize) / 2), Math.min(Math.max(0, (naturalSize!.height * nextScale - stageSize) / 2), current.y)) }));
  };
  const beginDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!naturalSize) return;
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const drag = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = dragRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    setOffset(clampOffset({ x: state.offsetX + event.clientX - state.x, y: state.offsetY + event.clientY - state.y }));
  };
  const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };
  const confirmCrop = () => {
    const image = imageRef.current;
    if (!image || !naturalSize) return;
    const cropWidth = stageSize / scale;
    const cropHeight = stageSize / scale;
    const sourceX = (naturalSize.width - cropWidth) / 2 - offset.x / scale;
    const sourceY = (naturalSize.height - cropHeight) / 2 - offset.y / scale;
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(image, sourceX, sourceY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
    onConfirm(canvas.toDataURL("image/jpeg", 0.92));
  };

  return <div className="admin-crop-backdrop" role="presentation">
    <section className="admin-crop-dialog" role="dialog" aria-modal="true" aria-labelledby="crop-title">
      <div className="admin-crop-heading"><div><p>图片裁剪</p><h2 id="crop-title">选择用户端展示区域</h2></div><button type="button" onClick={onCancel} aria-label="取消图片裁剪"><X size={18} /></button></div>
      <p className="admin-crop-hint">拖动图片调整展示位置；使用滑杆放大或缩小。确认后会生成统一的正方形图片，管理端与用户端显示完全一致。</p>
      <div ref={stageRef} className="admin-crop-stage" onPointerDown={beginDrag} onPointerMove={drag} onPointerUp={finishDrag} onPointerCancel={finishDrag}>
        <img ref={imageRef} src={source} alt="等待裁剪的图片" draggable={false} onLoad={(event) => { setNaturalSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight }); refreshStageSize(); }} style={{ width: `${renderedWidth}px`, height: `${renderedHeight}px`, transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)` }} />
        <span className="admin-crop-frame" aria-hidden="true" />
      </div>
      <label className="admin-crop-zoom">缩放裁剪区域<input type="range" min="1" max="3" step="0.01" value={zoom} disabled={!naturalSize} onChange={(event) => updateZoom(Number(event.target.value))} /><output>{Math.round(zoom * 100)}%</output></label>
      <div className="admin-crop-actions"><button type="button" className="admin-secondary" onClick={onCancel}>取消</button><button type="button" className="admin-primary" onClick={confirmCrop} disabled={!naturalSize}>确认裁剪并使用</button></div>
    </section>
  </div>;
}

export default function AdminApp() {
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerPhone, setRegisterPhone] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [content, setContent] = useState<ManagedContent>(
    clone(fallbackContent),
  );
  const [cropDraft, setCropDraft] = useState<CropDraft | null>(null);
  const [tab, setTab] = useState<Tab>("photos");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [autoSaveState, setAutoSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const persistedSnapshotRef = useRef<string | null>(null);
  const latestContentRef = useRef(content);

  useEffect(() => {
    latestContentRef.current = content;
  }, [content]);

  async function refreshStatus() {
    const next = await api<AdminStatus>("/api/admin/status");
    setStatus(next);
    if (next.authenticated) {
      const loaded = await api<ManagedContent>("/api/admin/content");
      persistedSnapshotRef.current = JSON.stringify(loaded);
      setContent(loaded);
      setAutoSaveState("idle");
    } else {
      persistedSnapshotRef.current = null;
      setAutoSaveState("idle");
    }
  }

  useEffect(() => {
    void refreshStatus().catch((error: Error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    if (!status?.authenticated || persistedSnapshotRef.current === null) return;
    const snapshot = JSON.stringify(content);
    if (snapshot === persistedSnapshotRef.current) return;
    if (content.siteLinks.some((link) => pointsToAdmin(link.url))) {
      setAutoSaveState("error");
      return;
    }
    setAutoSaveState("saving");
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const next = await api<ManagedContent>("/api/admin/content", {
            method: "PUT",
            body: snapshot,
          });
          persistedSnapshotRef.current = JSON.stringify(next);
          if (JSON.stringify(latestContentRef.current) === snapshot) setContent(next);
          notifyPublicContent(next);
          setAutoSaveState("saved");
        } catch {
          setAutoSaveState("error");
        }
      })();
    }, 30_000);
    return () => window.clearTimeout(timer);
  }, [content, status?.authenticated]);

  async function submitAuth(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await api("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      setPassword("");
      await refreshStatus();
      setMessage("登录成功，正在进入管理后台。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登录失败。");
    } finally {
      setBusy(false);
    }
  }

  async function submitRegistration(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await api("/api/admin/register", {
        method: "POST",
        body: JSON.stringify({
          username: registerUsername,
          password: registerPassword,
          phone: registerPhone,
          accessCode,
        }),
      });
      setRegisterPassword("");
      setAccessCode("");
      await refreshStatus();
      setMessage("管理员账号已创建，已进入管理后台。");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "创建管理员账号失败。",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveContent() {
    if (content.siteLinks.some((link) => pointsToAdmin(link.url))) {
      setMessage("站内链接不允许指向管理后台。");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const next = await api<ManagedContent>("/api/admin/content", {
        method: "PUT",
        body: JSON.stringify(content),
      });
      persistedSnapshotRef.current = JSON.stringify(next);
      setContent(next);
      notifyPublicContent(next);
      setAutoSaveState("saved");
      setMessage("内容已发布，用户端会自动同步。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败。");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await api("/api/admin/logout", { method: "POST" });
    setStatus({ configured: true, authenticated: false });
    persistedSnapshotRef.current = null;
    setContent(clone(fallbackContent));
    setMessage("已退出管理后台。");
  }

  function move<T>(items: T[], index: number, offset: number) {
    const target = index + offset;
    if (target < 0 || target >= items.length) return items;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  }

  function updatePhoto(index: number, patch: Partial<HeroPhoto>) {
    setContent((current) => ({
      ...current,
      heroPhotos: current.heroPhotos.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));
  }
  function setCardVisualMode(index: number, mode: "template" | "image") {
    const defaultTemplate = templateOptions[0];
    setContent((current) => ({
      ...current,
      heroPhotos: current.heroPhotos.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        if (mode === "image")
          return { ...item, tone: "photo", showSeal: false, showTemplateContent: false };
        const isTemplateArtwork = templateOptions.some(
          (style) => style.imageUrl === item.imageUrl,
        );
        const hasUploadedImage = Boolean(item.imageUrl) && !isTemplateArtwork;
        return hasUploadedImage
          ? { ...item, tone: "plain", showSeal: false, showTemplateContent: false }
          : { ...item, tone: defaultTemplate.tone, imageUrl: defaultTemplate.imageUrl, showSeal: true, showTemplateContent: true };
      }),
    }));
  }
  function setTemplateStyle(index: number, tone: TemplateTone) {
    const style = templateOptions.find((item) => item.tone === tone)!;
    setContent((current) => ({
      ...current,
      heroPhotos: current.heroPhotos.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        if (item.tone === tone && isTemplateContentEnabled(item)) {
          return { ...item, showTemplateContent: false, showSeal: false };
        }
        const isTemplateArtwork = templateOptions.some(
          (template) => template.imageUrl === item.imageUrl,
        );
        return {
          ...item,
          tone: style.tone,
          imageUrl:
            !item.imageUrl || isTemplateArtwork
              ? style.imageUrl
              : item.imageUrl,
          showSeal: true,
          showTemplateContent: true,
        };
      }),
    }));
  }
  function updateNews(index: number, patch: Partial<CampusNews>) {
    setContent((current) => ({
      ...current,
      news: current.news.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));
  }
  function updateLink(index: number, patch: Partial<CampusSiteLink>) {
    setContent((current) => ({
      ...current,
      siteLinks: current.siteLinks.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));
  }

  async function selectPhoto(
    index: number,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 3 * 1024 * 1024
    ) {
      setMessage("请使用不超过 3MB 的 JPEG、PNG 或 WebP 图片。");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setCropDraft({ index, src: String(reader.result), alt: file.name.replace(/\.[^.]+$/, "") || "校园照片" });
    reader.readAsDataURL(file);
  }

  if (!status)
    return (
      <main className="admin-shell">
        <p className="admin-loading">正在检查管理员状态…</p>
      </main>
    );

  if (!status.authenticated)
    return (
      <main className="admin-shell admin-auth-shell">
        <a className="admin-back" href="/">
          <ArrowLeft size={17} />
          返回公开首页
        </a>
        <section className="admin-auth-card">
          <span className="admin-lock">
            <KeyRound size={25} />
          </span>
          <p className="admin-kicker">私有内容管理</p>
          {authMode === "login" ? (
            <>
              <h1>管理员登录</h1>
              <p>仅已授权的管理员可以修改公开内容。</p>
              <form onSubmit={submitAuth}>
                <Field
                  label="管理员用户名"
                  value={username}
                  onChange={setUsername}
                />
                <Field
                  label="密码"
                  value={password}
                  onChange={setPassword}
                  type="password"
                />
                <button className="admin-primary" disabled={busy}>
                  {busy ? "处理中…" : "登录后台"}
                </button>
              </form>
              <button
                className="admin-auth-switch"
                type="button"
                onClick={() => {
                  setAuthMode("register");
                  setMessage("");
                }}
              >
                创建管理员账号
              </button>
            </>
          ) : (
            <>
              <button
                className="admin-auth-return"
                type="button"
                onClick={() => {
                  setAuthMode("login");
                  setMessage("");
                }}
              >
                ← 返回管理员登录
              </button>
              <h1>创建管理员账号</h1>
              <p>需填写内部码验证；验证成功后会直接进入管理后台。</p>
              <form onSubmit={submitRegistration}>
                <Field
                  label="管理员用户名"
                  value={registerUsername}
                  onChange={setRegisterUsername}
                />
                <Field
                  label="密码（至少 12 位）"
                  value={registerPassword}
                  onChange={setRegisterPassword}
                  type="password"
                />
                <Field
                  label="管理员手机号码"
                  value={registerPhone}
                  onChange={setRegisterPhone}
                  type="tel"
                />
                <Field
                  label="内部码"
                  value={accessCode}
                  onChange={setAccessCode}
                  type="password"
                />
                <button className="admin-secondary" disabled={busy}>
                  {busy ? "处理中…" : "创建并进入后台"}
                </button>
              </form>
            </>
          )}
          {message && (
            <AdminNotice message={message} onDismiss={() => setMessage("")} />
          )}
        </section>
      </main>
    );

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <div>
          <p>私有内容管理</p>
          <h1>校园生活决策助手</h1>
        </div>
        <nav>
          <a href="/">
            <ArrowLeft size={16} />
            公开首页
          </a>
          <button type="button" onClick={() => void logout()}>
            <LogOut size={16} />
            退出
          </button>
        </nav>
      </header>
      <section className="admin-workspace">
        <aside className="admin-sidebar">
          <button
            className={tab === "photos" ? "is-active" : ""}
            onClick={() => setTab("photos")}
          >
            <FileImage size={18} />
            首页卡片
          </button>
          <button
            className={tab === "news" ? "is-active" : ""}
            onClick={() => setTab("news")}
          >
            <Newspaper size={18} />
            校园新闻
          </button>
          <button
            className={tab === "links" ? "is-active" : ""}
            onClick={() => setTab("links")}
          >
            <Link2 size={18} />
            校园网站链接
          </button>
          <div>
            <strong>发布范围</strong>
            <p>保存后公开首页会读取最新内容；普通用户没有管理入口。</p>
          </div>
        </aside>
        <section className="admin-content">
          <div className="admin-content-heading">
            <div>
              <p>
                {tab === "photos"
                  ? "首页卡片"
                  : tab === "news"
                    ? "校园新闻"
                    : "校园资源导航"}
              </p>
              <h2>
                {tab === "photos"
                  ? "插入、替换与调整卡片"
                  : tab === "news"
                    ? "发布或更新校园新闻"
                    : "更新真实网站链接"}
              </h2>
            </div>
            <button
              className="admin-primary"
              onClick={() => void saveContent()}
              disabled={busy}
            >
              <Save size={17} />
              {busy ? "保存中…" : "保存并发布"}
            </button>
          </div>
          {message && <p className="admin-message">{message}</p>}
          {autoSaveState !== "idle" && <p className={`admin-message admin-autosave-status is-${autoSaveState}`}>{autoSaveState === "saving" ? "正在自动保存并同步用户端…" : autoSaveState === "saved" ? "已自动保存并同步用户端。" : "自动保存失败，请点击“保存并发布”重试。"}</p>}
          {tab === "photos" && (
            <div className="admin-editor-list">
              {content.heroPhotos.map((photo, index) => (
                <article className="admin-editor-card" key={photo.id}>
                  <div className="admin-editor-toolbar">
                    <strong>首页卡片 {index + 1}</strong>
                    <div>
                      <button
                        type="button"
                        onClick={() =>
                          setContent((current) => ({
                            ...current,
                            heroPhotos: move(current.heroPhotos, index, -1),
                          }))
                        }
                        aria-label="上移"
                      >
                        <ChevronUp size={17} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setContent((current) => ({
                            ...current,
                            heroPhotos: move(current.heroPhotos, index, 1),
                          }))
                        }
                        aria-label="下移"
                      >
                        <ChevronDown size={17} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setContent((current) => ({
                            ...current,
                            heroPhotos: current.heroPhotos.filter(
                              (_, itemIndex) => itemIndex !== index,
                            ),
                          }))
                        }
                        aria-label="删除"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </div>
                  <div className="admin-photo-grid">
                    <div className="admin-card-visuals">
                      <div
                        className="admin-card-mode"
                        role="group"
                        aria-label="卡片功能类型"
                      >
                        <label>
                          <input
                            type="radio"
                            name={`card-mode-${photo.id}`}
                            checked={!isImageDisplay(photo)}
                            onChange={() =>
                              setCardVisualMode(index, "template")
                            }
                          />
                          文字模板
                        </label>
                        <label>
                          <input
                            type="radio"
                            name={`card-mode-${photo.id}`}
                            checked={isImageDisplay(photo)}
                            onChange={() => setCardVisualMode(index, "image")}
                          />
                          图片展示
                        </label>
                      </div>
                      {!isImageDisplay(photo) ? (
                        <>
                          <div
                            className="admin-template-style-picker"
                            role="group"
                            aria-label="文字模板风格"
                          >
                            {templateOptions.map((style) => (
                              <button
                                key={style.tone}
                                type="button"
                                className={
                                  isTemplateContentEnabled(photo) && templateToneFor(photo) === style.tone
                                    ? "is-active"
                                    : ""
                                }
                                onClick={() =>
                                  setTemplateStyle(index, style.tone)
                                }
                              >
                                <span>{style.title}</span>
                                <small>{style.description}</small>
                              </button>
                            ))}
                          </div>
                          <p className="admin-template-hint">
                            点击模板文字可直接修改；拖动圆点可移动校徽、文字或贴图。画笔可调样式，× 可删除，删除后可恢复。
                          </p>
                          <TemplateLivePreview
                            photo={photo}
                            onChange={(patch) => updatePhoto(index, patch)}
                          />
                        </>
                      ) : (
                        <label className="admin-image-picker">
                          {photo.imageUrl ? (
                            <img src={photo.imageUrl} alt="待发布预览" />
                          ) : (
                            <FileImage size={28} />
                          )}
                          <span>选择或替换图片</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(event) => void selectPhoto(index, event)}
                          />
                        </label>
                      )}
                    </div>
                    {isImageDisplay(photo) && (
                      <div className="admin-image-display-note">
                        此卡片只展示图片本身，不叠加标题、文字、校徽或信息框。
                      </div>
                    )}
                  </div>
                </article>
              ))}
              <button
                className="admin-add"
                onClick={() =>
                  setContent((current) => ({
                    ...current,
                    heroPhotos: [...current.heroPhotos, blankPhoto()],
                  }))
                }
              >
                <Plus size={18} />
                新增首屏卡片
              </button>
            </div>
          )}
          {tab === "news" && (
            <div className="admin-editor-list">
              {content.news.map((news, index) => (
                <article className="admin-editor-card" key={news.id}>
                  <div className="admin-editor-toolbar">
                    <strong>新闻 {index + 1}</strong>
                    <button
                      type="button"
                      onClick={() =>
                        setContent((current) => ({
                          ...current,
                          news: current.news.filter(
                            (_, itemIndex) => itemIndex !== index,
                          ),
                        }))
                      }
                      aria-label="删除"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                  <div className="admin-fields two">
                    <Field
                      label="标题"
                      value={news.title}
                      onChange={(value) => updateNews(index, { title: value })}
                    />
                    <Field
                      label="分类"
                      value={news.category}
                      onChange={(value) =>
                        updateNews(index, { category: value })
                      }
                    />
                    <Field
                      label="日期"
                      value={news.date}
                      onChange={(value) => updateNews(index, { date: value })}
                    />
                    <Field
                      label="标签（用中文逗号分隔）"
                      value={news.tags.join("，")}
                      onChange={(value) =>
                        updateNews(index, {
                          tags: value
                            .split(/[，,]/)
                            .map((item) => item.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                    <Field
                      label="摘要"
                      value={news.summary}
                      onChange={(value) =>
                        updateNews(index, { summary: value })
                      }
                      multiline
                    />
                    <Field
                      label="详情"
                      value={news.details}
                      onChange={(value) =>
                        updateNews(index, { details: value })
                      }
                      multiline
                    />
                    <Field
                      label="文章出处"
                      value={news.source ?? ""}
                      onChange={(value) => updateNews(index, { source: value })}
                      placeholder="例如：华侨大学新闻网"
                    />
                  </div>
                </article>
              ))}
              <button
                className="admin-add"
                onClick={() =>
                  setContent((current) => ({
                    ...current,
                    news: [blankNews(), ...current.news],
                  }))
                }
              >
                <Plus size={18} />
                新增校园新闻
              </button>
            </div>
          )}
          {tab === "links" && (
            <div className="admin-editor-list">
              {content.siteLinks.map((link, index) => (
                <article className="admin-editor-card" key={link.id}>
                  <div className="admin-editor-toolbar">
                    <strong>网站链接 {index + 1}</strong>
                    <button
                      type="button"
                      onClick={() =>
                        setContent((current) => ({
                          ...current,
                          siteLinks: current.siteLinks.filter(
                            (_, itemIndex) => itemIndex !== index,
                          ),
                        }))
                      }
                      aria-label="删除"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                  <div className="admin-fields two">
                    <Field
                      label="网站名称"
                      value={link.title}
                      onChange={(value) => updateLink(index, { title: value })}
                    />
                    <Field
                      label="用途说明"
                      value={link.note}
                      onChange={(value) => updateLink(index, { note: value })}
                    />
                    <Field
                      label="真实链接"
                      value={link.url}
                      onChange={(value) => updateLink(index, { url: value })}
                    />
                    <label className="admin-field">
                      <span>图标</span>
                      <select
                        value={link.icon}
                        onChange={(event) =>
                          updateLink(index, { icon: event.target.value })
                        }
                      >
                        <option value="landmark">学校</option>
                        <option value="graduation">教务</option>
                        <option value="library">图书馆</option>
                        <option value="users">学生服务</option>
                        <option value="monitor">信息服务</option>
                        <option value="book">门户</option>
                      </select>
                    </label>
                  </div>
                </article>
              ))}
              <button
                className="admin-add"
                onClick={() =>
                  setContent((current) => ({
                    ...current,
                    siteLinks: [...current.siteLinks, blankLink()],
                  }))
                }
              >
                <Plus size={18} />
                新增网站链接
              </button>
            </div>
          )}
        </section>
      </section>
      {cropDraft && <PhotoCropDialog source={cropDraft.src} onCancel={() => setCropDraft(null)} onConfirm={(imageUrl) => {
        updatePhoto(cropDraft.index, { imageUrl, alt: cropDraft.alt, tone: "photo", showSeal: false, showTemplateContent: false });
        setCropDraft(null);
      }} />}
    </main>
  );
}
