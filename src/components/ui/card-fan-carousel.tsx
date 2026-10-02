"use client";

import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { templateDecorationForTone } from "../../content";

export interface CardItem {
  imgUrl: string;
  alt?: string;
  eyebrow: string;
  title: string;
  emphasis: string;
  description: string;
  trust: string;
  metricLabel: string;
  metricValue: string;
  metricCaption: string;
  routeLabel: string;
  routeValue: string;
  signals: readonly string[];
  tone: "start" | "filter" | "explain" | "photo" | "plain";
  showSeal?: boolean;
  showTemplate?: boolean;
  layout?: Partial<
    Record<
      "eyebrow" | "headline" | "description" | "trust" | "summary" | "route" | "seal",
      { x: number; y: number }
    >
  >;
  overlays?: Array<{
    id: string;
    kind: "text" | "sticker" | "image";
    text: string;
    x: number;
    y: number;
    fontSize: number;
    fontFamily: "sans" | "serif" | "rounded" | "handwriting";
    color: string;
    shape?: "pill" | "circle" | "star" | "burst" | "tag";
    background?: string;
    imageUrl?: string;
    size?: number;
  }>;
  templateStyles?: Partial<Record<"eyebrow" | "headline" | "description" | "trust" | "seal", { fontSize?: number; fontFamily?: "sans" | "serif" | "rounded" | "handwriting"; color?: string; size?: number }>>;
  hiddenTemplateElements?: Array<"eyebrow" | "headline" | "description" | "trust" | "seal">;
}

interface CardFanCarouselProps {
  cards: CardItem[];
}

// With photo cards, showing every card at once makes layers visually cut through
// each other. Keep the fan to the immediate previous/current/next trio.
const MAX_VISIBLE = 3;
const HALF = 1;

const FAN_POSITIONS = [
  { rot: -13, scale: 0.84, x: -18, y: 4.2, zIndex: 2 },
  { rot: 0, scale: 1, x: 0, y: 0, zIndex: 10 },
  { rot: 13, scale: 0.84, x: 18, y: 4.2, zIndex: 2 },
];

function layoutStyle(position?: { x: number; y: number }) {
  return position
    ? {
        left: `${position.x}%`,
        top: `${position.y}%`,
        right: "auto",
        bottom: "auto",
      }
    : undefined;
}

const overlayFontFamily = {
  sans: '"Microsoft YaHei", "PingFang SC", sans-serif',
  serif: 'Georgia, "Songti SC", serif',
  rounded: '"Arial Rounded MT Bold", "Microsoft YaHei", sans-serif',
  handwriting: '"KaiTi", "STKaiti", cursive',
} as const;

function overlayStyle(overlay: NonNullable<CardItem["overlays"]>[number]) {
  return {
    left: `${overlay.x}%`,
    top: `${overlay.y}%`,
    color: overlay.color,
    fontSize: `${overlay.fontSize}px`,
    fontFamily: overlayFontFamily[overlay.fontFamily],
    ...(overlay.kind === "sticker" && overlay.background
      ? { "--overlay-background": overlay.background }
      : {}),
    ...(overlay.kind !== "text" ? { "--overlay-size": `${overlay.size ?? (overlay.kind === "image" ? 86 : 92)}px` } : {}),
  } as CSSProperties;
}

function templateTextStyle(style?: NonNullable<CardItem["templateStyles"]>["eyebrow"]) {
  return style ? { color: style.color, fontSize: style.fontSize ? `${style.fontSize}px` : undefined, fontFamily: style.fontFamily ? overlayFontFamily[style.fontFamily] : undefined } : undefined;
}

function getResponsiveMultiplier(width: number) {
  if (width < 480) return 0.28;
  if (width < 640) return 0.38;
  if (width < 768) return 0.5;
  if (width < 1024) return 0.75;
  return 1;
}

function getHeightMultiplier(width: number) {
  const idealPx =
    width < 480
      ? 352
      : width < 640
        ? 416
        : width < 768
          ? 448
          : width < 1024
            ? 544
            : 608;
  const available = window.innerHeight * 0.7;
  return available >= idealPx ? 1 : available / idealPx;
}

function getSlotConfig(totalCards: number, slot: number) {
  if (totalCards >= MAX_VISIBLE) return FAN_POSITIONS[slot];
  const center = totalCards >> 1;
  const distance = totalCards > 1 ? (slot - center) / center : 0;
  const absDistance = Math.abs(distance);
  return {
    rot: distance * 21,
    scale: 1 - 0.2244 * absDistance * absDistance,
    x: distance * 30,
    y: absDistance * absDistance * 7.3,
    zIndex: 10 - Math.abs(slot - center),
  };
}

/** Campus-adapted version of the supplied GSAP card-fan component. */
export default function CardFanCarousel({ cards }: CardFanCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isAnimating = useRef(false);
  const hasEntered = useRef(false);
  const directionRef = useRef<"left" | "right" | null>(null);
  const prevVisible = useRef<Set<number>>(new Set());
  const totalCards = cards.length;
  const needsPagination = totalCards > MAX_VISIBLE;
  const [centerIndex, setCenterIndex] = useState(0);
  const previousCenterIndex = useRef(centerIndex);

  const getVisibleMap = useCallback(
    (center: number) => {
      const map = new Map<number, number>();
      if (!needsPagination) {
        // Keep the currently active card at the visual centre while the three
        // campus messages rotate.  Without this mapping only the heading changed
        // after a cycle, leaving the active card parked in a side slot.
        const centreSlot = totalCards >> 1;
        cards.forEach((_, index) => {
          const slot =
            (((index - center + centreSlot) % totalCards) + totalCards) %
            totalCards;
          map.set(index, slot);
        });
        return map;
      }
      for (let slot = 0; slot < MAX_VISIBLE; slot += 1)
        map.set(
          (((center + slot - HALF) % totalCards) + totalCards) % totalCards,
          slot,
        );
      return map;
    },
    [cards, needsPagination, totalCards],
  );

  const goTo = useCallback(
    (nextIndex: number) => {
      if (isAnimating.current || totalCards < 2) return;
      const normalizedIndex = (nextIndex + totalCards) % totalCards;
      if (normalizedIndex === centerIndex) return;
      isAnimating.current = true;
      const forwardDistance =
        (normalizedIndex - centerIndex + totalCards) % totalCards;
      directionRef.current =
        forwardDistance > 0 && forwardDistance <= totalCards / 2
          ? "right"
          : "left";
      setCenterIndex(normalizedIndex);
    },
    [centerIndex, totalCards],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !totalCards) return;
    const cardElements = Array.from(
      container.querySelectorAll<HTMLElement>(".fan-card"),
    );
    if (!cardElements.length) return;

    const visibleMap = getVisibleMap(centerIndex);
    cardElements.forEach((card, index) => {
      if (visibleMap.has(index))
        gsap.set(card, { autoAlpha: 1, pointerEvents: "auto" });
      else gsap.set(card, { autoAlpha: 0, pointerEvents: "none", zIndex: 0 });
    });
    const previouslyVisible = prevVisible.current;
    const direction = directionRef.current;
    const isFirstMount = !hasEntered.current;
    const leavingIndex = previousCenterIndex.current;
    const multiplier = getResponsiveMultiplier(window.innerWidth);
    const heightMultiplier = getHeightMultiplier(window.innerWidth);
    const slotCount = needsPagination ? MAX_VISIBLE : totalCards;
    const config = (slot: number) => getSlotConfig(slotCount, slot);
    const centreSlot = Math.floor((slotCount - 1) / 2);
    if (isFirstMount) isAnimating.current = true;
    let completedCount = 0;
    const visibleCount = visibleMap.size;
    const onCardDone = () => {
      completedCount += 1;
      if (completedCount >= visibleCount) {
        isAnimating.current = false;
        if (isFirstMount) hasEntered.current = true;
      }
    };

    if (!isFirstMount && !needsPagination) {
      const targetFor = (cardIndex: number) => {
        const slot = visibleMap.get(cardIndex)!;
        const { x, y, rot, scale, zIndex } = config(slot);
        return {
          x: `${x * multiplier}rem`,
          y: `${y * heightMultiplier}rem`,
          rotation: rot,
          scale,
          opacity: 1,
          zIndex,
        };
      };
      const exitCard = cardElements[leavingIndex];
      const enteringCard = cardElements[centerIndex];
      const crossingCard = cardElements.find(
        (_, index) => index !== leavingIndex && index !== centerIndex,
      );
      const exitContent =
        exitCard.querySelector<HTMLElement>(".fan-card__content");
      const enteringContent =
        enteringCard.querySelector<HTMLElement>(".fan-card__content");
      const exitDirection = direction === "right" ? -1 : 1;
      const timeline = gsap.timeline({
        onComplete: () => {
          cardElements.forEach((card) =>
            gsap.set(card, { willChange: "auto" }),
          );
          isAnimating.current = false;
        },
      });

      // The old centre card sinks into the fan, the incoming side card lifts to
      // the front, and the third card travels behind them.  This makes every
      // manual click read as a real card hand-off rather than a state jump.
      timeline.set(cardElements, { willChange: "transform,opacity" });
      timeline.set(exitCard, { zIndex: 12 });
      timeline.set(enteringCard, { zIndex: 13 });
      if (crossingCard) timeline.set(crossingCard, { zIndex: 1 });
      const exitTarget = targetFor(leavingIndex);
      const enteringTarget = targetFor(centerIndex);
      timeline.to(
        exitCard,
        {
          ...exitTarget,
          y: `${Number.parseFloat(exitTarget.y) + 1.25 * heightMultiplier}rem`,
          scale: (exitTarget.scale as number) * 0.96,
          opacity: 0.82,
          duration: 0.42,
          ease: "power2.in",
        },
        0,
      );
      timeline.to(
        exitCard,
        { ...exitTarget, duration: 0.43, ease: "power3.out" },
        0.42,
      );
      timeline.to(
        exitContent,
        {
          x: `${exitDirection * 1.1}rem`,
          opacity: 0.58,
          duration: 0.24,
          ease: "power2.in",
        },
        0,
      );
      timeline.to(
        enteringCard,
        { ...enteringTarget, duration: 0.92, ease: "back.out(1.25)" },
        0.08,
      );
      timeline.fromTo(
        enteringContent,
        { x: `${-exitDirection * 1.35}rem`, opacity: 0.56 },
        { x: 0, opacity: 1, duration: 0.48, ease: "power3.out" },
        0.29,
      );
      if (crossingCard) {
        const crossingTarget = targetFor(cardElements.indexOf(crossingCard));
        timeline.to(
          crossingCard,
          {
            ...crossingTarget,
            y: `${Number.parseFloat(crossingTarget.y) + 1.45 * heightMultiplier}rem`,
            scale: (crossingTarget.scale as number) * 0.92,
            opacity: 0.72,
            duration: 0.38,
            ease: "power2.inOut",
          },
          0,
        );
        timeline.to(
          crossingCard,
          { ...crossingTarget, duration: 0.45, ease: "power2.out" },
          0.38,
        );
      }
      timeline.to(
        exitContent,
        { x: 0, opacity: 1, duration: 0.3, ease: "power2.out" },
        0.55,
      );
      previousCenterIndex.current = centerIndex;
    } else
      cardElements.forEach((card, cardIndex) => {
        const slot = visibleMap.get(cardIndex);
        const wasVisible = previouslyVisible.has(cardIndex);
        if (slot === undefined) return;
        const { x, y, rot, scale, zIndex } = config(slot);
        // The reference fan keeps the focused card crisp and pushes its neighbours
        // into a quieter preview layer. This is especially important for photos.
        const target = {
          x: `${x * multiplier}rem`,
          y: `${y * heightMultiplier}rem`,
          rotation: rot,
          scale,
          opacity: slot === centreSlot ? 1 : 0.58,
          zIndex,
        };
        if (isFirstMount) {
          // Each layer materializes at its own side of the fan. Starting all cards
          // from the centre caused photo cards to visibly pass through one another.
          const sideOffset = slot < centreSlot ? -5 : slot > centreSlot ? 5 : 0;
          gsap.set(card, {
            x: `${(x + sideOffset) * multiplier}rem`,
            y: `${(y + 5) * heightMultiplier}rem`,
            rotation: rot,
            scale: scale * 0.94,
            opacity: 0,
          });
          gsap.to(card, {
            ...target,
            duration: 0.68,
            ease: "power3.out",
            delay: 0.04 + Math.abs(slot - centreSlot) * 0.05,
            onComplete: onCardDone,
          });
        } else if (!wasVisible) {
          const enterX = direction === "right" ? 40 : -40;
          gsap.set(card, {
            x: `${enterX}rem`,
            y: `${y * heightMultiplier}rem`,
            rotation: direction === "right" ? 30 : -30,
            scale: 0.5,
            opacity: 0,
          });
          gsap.to(card, {
            ...target,
            duration: 0.6,
            ease: "power2.out",
            onComplete: onCardDone,
          });
        } else {
          gsap.to(card, {
            ...target,
            duration: 0.5,
            ease: "power2.out",
            onComplete: onCardDone,
          });
        }
      });
    prevVisible.current = new Set(visibleMap.keys());
    if (isFirstMount || needsPagination)
      previousCenterIndex.current = centerIndex;

    const visibleEntries = cardElements
      .flatMap((element, index) => {
        const slot = visibleMap.get(index);
        return slot === undefined ? [] : [{ element, slot }];
      })
      .sort((a, b) => a.slot - b.slot);
    let activeSlot: number | null = null;
    let leaveTimer: number | null = null;
    const centerSlot = visibleEntries.length >> 1;
    const updateHoverLayout = (hoveredSlot: number | null) => {
      if (isAnimating.current) return;
      const widthMultiplier = getResponsiveMultiplier(window.innerWidth);
      const hMultiplier = getHeightMultiplier(window.innerWidth);
      visibleEntries.forEach(({ element, slot }) => {
        const base = config(slot);
        let x = base.x * widthMultiplier;
        let y = base.y * hMultiplier;
        let rotation = base.rot;
        let scale = base.scale;
        const distance =
          hoveredSlot === null
            ? Math.abs(slot - centerSlot)
            : Math.abs(slot - hoveredSlot);
        if (hoveredSlot !== null) {
          if (slot === hoveredSlot) {
            y -= 2.5 * hMultiplier;
            scale *= 1.08;
          } else {
            const normalized =
              centerSlot > 0 ? (slot - centerSlot) / centerSlot : 0;
            const push =
              8 *
              (1 - Math.abs(normalized)) *
              (1 + 0.2 * Math.max(0, 3 - distance));
            if (slot < hoveredSlot) {
              x -= push * widthMultiplier;
              rotation -= 3 / (distance + 1);
            } else {
              x += push * widthMultiplier;
              rotation += 3 / (distance + 1);
            }
          }
        }
        gsap.to(element, {
          x: `${x}rem`,
          y: `${y}rem`,
          rotation,
          scale,
          duration: 0.5,
          delay: distance * 0.02,
          ease: "elastic.out(1,.75)",
          overwrite: "auto",
        });
        gsap.set(element, { zIndex: base.zIndex });
      });
    };
    const handlers = visibleEntries.map(({ element, slot }) => {
      const handler = () => {
        if (leaveTimer) {
          window.clearTimeout(leaveTimer);
          leaveTimer = null;
        }
        if (activeSlot !== slot) {
          activeSlot = slot;
          updateHoverLayout(slot);
        }
      };
      element.addEventListener("mouseenter", handler);
      return { element, handler };
    });
    const handleLeave = () => {
      if (leaveTimer) window.clearTimeout(leaveTimer);
      leaveTimer = window.setTimeout(() => {
        activeSlot = null;
        updateHoverLayout(null);
      }, 50);
    };
    const handleResize = () => updateHoverLayout(activeSlot);
    container.addEventListener("mouseleave", handleLeave);
    window.addEventListener("resize", handleResize);
    // A cancelled browser frame must never leave manual controls locked.
    const settleTimer = window.setTimeout(
      () => {
        isAnimating.current = false;
      },
      isFirstMount ? 1100 : 760,
    );
    return () => {
      handlers.forEach(({ element, handler }) =>
        element.removeEventListener("mouseenter", handler),
      );
      container.removeEventListener("mouseleave", handleLeave);
      window.removeEventListener("resize", handleResize);
      if (leaveTimer) window.clearTimeout(leaveTimer);
      window.clearTimeout(settleTimer);
      gsap.killTweensOf(cardElements);
    };
  }, [centerIndex, getVisibleMap, needsPagination, totalCards]);

  if (!totalCards) return null;
  return (
    <section
      className="card-fan-carousel"
      aria-labelledby="page-title"
      aria-roledescription="校园助手内容轮换区"
    >
      {totalCards > 1 && (
        <div className="fan-controls" aria-label="切换介绍内容">
          <button
            type="button"
            className="fan-control-arrow"
            onClick={() => goTo(centerIndex - 1)}
            aria-label="查看上一张介绍"
          >
            <ChevronLeft aria-hidden="true" size={19} />
          </button>
          <div
            className="fan-pagination"
            role="group"
            aria-label={`共 ${totalCards} 张介绍内容`}
          >
            {cards.map((card, index) => (
              <button
                key={card.title}
                type="button"
                className={index === centerIndex ? "is-active" : ""}
                aria-label={`查看第 ${index + 1} 张：${card.title}${card.emphasis}`}
                aria-current={index === centerIndex ? "true" : undefined}
                onClick={() => goTo(index)}
              >
                <span className="sr-only">第 {index + 1} 张</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="fan-control-arrow"
            onClick={() => goTo(centerIndex + 1)}
            aria-label="查看下一张介绍"
          >
            <ChevronRight aria-hidden="true" size={19} />
          </button>
        </div>
      )}
      <div ref={containerRef} className="fan-layout">
        {cards.map((card, index) => {
          const isCenter = index === centerIndex;
          return (
            <article
              key={`${card.title}-${index}`}
              className={`fan-card fan-card--${card.tone}`}
              aria-hidden={isCenter ? undefined : true}
            >
              {card.imgUrl && (
                <img
                  className="fan-card__art"
                  src={card.imgUrl}
                  alt={card.alt ?? ""}
                />
              )}
              {card.showTemplate !== false && card.showSeal && !card.hiddenTemplateElements?.includes("seal") && (
                <img
                  className="fan-card__official-seal"
                  src="/hero-cards/site-badge.svg"
                  alt=""
                  aria-hidden="true"
                  style={{ ...layoutStyle(card.layout?.seal), ...(card.templateStyles?.seal?.size ? { width: `${card.templateStyles.seal.size}px`, height: `${card.templateStyles.seal.size}px` } : {}) }}
                />
              )}
              {card.showTemplate !== false && (
                <div className="fan-card__content">
                  {(() => {
                    const decoration = templateDecorationForTone(card.tone);
                    return <div
                      className={`fan-card__overlay fan-card__overlay--sticker fan-card__overlay--${decoration.shape ?? "circle"}`}
                      style={overlayStyle(decoration)}
                      aria-hidden="true"
                    />;
                  })()}
                  {!card.hiddenTemplateElements?.includes("eyebrow") && <p
                    className="fan-card__eyebrow"
                    style={{ ...layoutStyle(card.layout?.eyebrow), ...templateTextStyle(card.templateStyles?.eyebrow) }}
                  >
                    ✦ {card.eyebrow}
                  </p>}
                  {!card.hiddenTemplateElements?.includes("headline") && (isCenter ? (
                    <h1
                      id="page-title"
                      style={{ ...layoutStyle(card.layout?.headline), ...templateTextStyle(card.templateStyles?.headline) }}
                    >
                      {card.title}
                      <em style={templateTextStyle(card.templateStyles?.headline)}>{card.emphasis}</em>
                    </h1>
                  ) : (
                    <h2 style={{ ...layoutStyle(card.layout?.headline), ...templateTextStyle(card.templateStyles?.headline) }}>
                      {card.title}
                      <em style={templateTextStyle(card.templateStyles?.headline)}>{card.emphasis}</em>
                    </h2>
                  ))}
                  {!card.hiddenTemplateElements?.includes("description") && <p
                    className="fan-card__description"
                    style={{ ...layoutStyle(card.layout?.description), ...templateTextStyle(card.templateStyles?.description) }}
                  >
                    {card.description}
                  </p>}
                  {!card.hiddenTemplateElements?.includes("trust") && <p
                    className="fan-card__trust"
                    style={{ ...layoutStyle(card.layout?.trust), ...templateTextStyle(card.templateStyles?.trust) }}
                  >
                    ♢ {card.trust}
                  </p>}
                </div>
              )}
              <div className="fan-card__overlays" aria-label="管理员添加的卡片图层">
                {card.overlays?.map((overlay) => (
                  <div
                    key={overlay.id}
                    className={`fan-card__overlay fan-card__overlay--${overlay.kind}${overlay.kind === "sticker" ? ` fan-card__overlay--${overlay.shape ?? "pill"}` : ""}`}
                    style={overlayStyle(overlay)}
                  >
                    {overlay.kind === "image" ? <img src={overlay.imageUrl} alt={overlay.text || "管理员添加的贴图"} /> : overlay.kind === "text" ? overlay.text : null}
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
