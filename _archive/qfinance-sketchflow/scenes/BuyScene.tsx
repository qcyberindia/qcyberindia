"use client";

import { useEffect, useRef } from "react";
import DrawPath from "../DrawPath";
import MovingDot from "../MovingDot";

// `id` (not `key`) is intentional -- these objects get spread directly into
// <Node {...node} />. React treats `key` as a special, non-spreadable prop,
// so it can never live inside an object that's spread into JSX. `key` is
// supplied separately at each call site below, sourced from `id`.
//
// Desktop geometry (viewBox 0 0 640 380 — see BeginnerJourneyC1's explicit
// viewBox override): EXCHANGE sits centered above BROKER and SELLER, with
// its two incoming paths (from BROKER and from SELLER) approaching its
// bottom edge from the left and right respectively. That leaves a clear
// ~90px gap directly beneath EXCHANGE, with no path passing through it, for
// the MATCHED stamp to sit in — the exact overlap problem from the previous
// layout (MATCHED sitting on top of the seller/exchange connector).
const DESKTOP_NODES = [
  { id: "you", x: 30, y: 282, w: 110, h: 58, label: "YOU", sub: "\u20b91,000 \u00b7 10 shares" },
  { id: "broker", x: 200, y: 282, w: 120, h: 58, label: "BROKER" },
  { id: "exchange", x: 290, y: 40, w: 180, h: 60, label: "EXCHANGE", sub: "order matching" },
  { id: "seller", x: 440, y: 282, w: 150, h: 58, label: "SELLER", sub: "another investor" },
];

const DESKTOP_PATHS = {
  youToBroker: "M140,311 L200,311",
  brokerToExchange: "M260,282 C260,220 300,150 340,100",
  sellerToExchange: "M500,282 C500,220 460,150 430,100",
};

// Centered in the clear gap between the two curves above (x 340\u2013430).
const DESKTOP_MATCH_STAMP = { x: 385, y: 190 };
const DESKTOP_LABELS = {
  buy: { x: 170, y: 300 },
  buyOrder: { x: 222, y: 205 },
  sell: { x: 508, y: 205 },
};

// Vertical stack for narrow viewports -- same four nodes, same relationships,
// just laid out top-to-bottom so nothing has to be scaled down to illegible
// sizes. Used together with CuriosityModule's `mobileViewBox`.
const MOBILE_NODES = [
  { id: "you", x: 90, y: 16, w: 160, h: 56, label: "YOU", sub: "\u20b91,000 \u00b7 10 shares" },
  { id: "broker", x: 90, y: 128, w: 160, h: 56, label: "BROKER" },
  { id: "exchange", x: 80, y: 240, w: 180, h: 56, label: "EXCHANGE", sub: "order matching" },
  { id: "seller", x: 90, y: 404, w: 160, h: 56, label: "SELLER", sub: "another investor" },
];

const MOBILE_PATHS = {
  youToBroker: "M170,72 L170,128",
  brokerToExchange: "M170,184 L170,240",
  sellerToExchange: "M170,404 L170,296",
};

// Offset to the side of the straight seller->exchange line (rather than
// sitting centered on top of it, which was the original overlap bug).
const MOBILE_MATCH_STAMP = { x: 255, y: 350 };
const MOBILE_LABELS = {
  buy: { x: 200, y: 104 },
  sell: { x: 200, y: 356 },
};

function Node({
  x,
  y,
  w,
  h,
  label,
  sub,
  visible,
  delay,
  reduceMotion,
  dim = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  sub?: string;
  visible: boolean;
  delay: number;
  reduceMotion: boolean;
  dim?: boolean;
}) {
  return (
    <g
      style={{
        opacity: reduceMotion ? (dim ? 0.35 : 1) : visible ? (dim ? 0.35 : 1) : 0,
        transform: reduceMotion ? "none" : visible ? "translateY(0)" : "translateY(6px)",
        transition:
          reduceMotion || !visible
            ? "none"
            : `opacity 450ms ease ${delay}ms, transform 450ms ease ${delay}ms`,
      }}
    >
      <rect x={x} y={y} width={w} height={h} rx={3} fill="var(--qf-cream-0)" stroke="currentColor" strokeWidth={2} />
      <text
        x={x + w / 2}
        y={sub ? y + h / 2 - 4 : y + h / 2 + 5}
        textAnchor="middle"
        fontFamily="var(--font-body, sans-serif)"
        fontSize="13.5"
        fontWeight={700}
        fill="currentColor"
      >
        {label}
      </text>
      {sub && (
        <text
          x={x + w / 2}
          y={y + h / 2 + 16}
          textAnchor="middle"
          fontFamily="var(--font-body, sans-serif)"
          fontSize="10"
          fill="var(--qf-ink-soft)"
        >
          {sub}
        </text>
      )}
    </g>
  );
}

function PathLabel({
  x,
  y,
  text,
  visible,
  delay,
  reduceMotion,
}: {
  x: number;
  y: number;
  text: string;
  visible: boolean;
  delay: number;
  reduceMotion: boolean;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fontSize="9.5"
      fontFamily="var(--font-body, sans-serif)"
      fontWeight={600}
      letterSpacing="0.03em"
      fill="var(--qf-brass-dark)"
      style={{
        opacity: reduceMotion ? 1 : visible ? 1 : 0,
        transition: reduceMotion || !visible ? "none" : `opacity 300ms ease ${delay}ms`,
      }}
    >
      {text}
    </text>
  );
}

function MatchedStamp({
  x,
  y,
  visible,
  delay,
  reduceMotion,
}: {
  x: number;
  y: number;
  visible: boolean;
  delay: number;
  reduceMotion: boolean;
}) {
  const w = 80;
  const h = 28;
  return (
    <g
      style={{
        opacity: reduceMotion ? 1 : visible ? 1 : 0,
        transform: reduceMotion ? "none" : visible ? "scale(1)" : "scale(0.85)",
        transformOrigin: `${x}px ${y}px`,
        transition:
          reduceMotion || !visible
            ? "none"
            : `opacity 350ms ease ${delay}ms, transform 350ms cubic-bezier(.34,1.4,.64,1) ${delay}ms`,
      }}
    >
      <rect
        x={x - w / 2}
        y={y - h / 2}
        width={w}
        height={h}
        rx={2}
        fill="var(--qf-brass)"
        fillOpacity={0.14}
        stroke="var(--qf-brass-dark)"
        strokeWidth={1.5}
      />
      <text
        x={x}
        y={y + 4}
        textAnchor="middle"
        fontFamily="var(--font-body, sans-serif)"
        fontSize="11.5"
        fontWeight={700}
        letterSpacing="0.06em"
        fill="var(--qf-brass-dark)"
      >
        MATCHED
      </text>
    </g>
  );
}

// Staged timeline (ms). Each stage waits for the previous one to have
// visibly landed before starting, so the scene reads as a sequence of
// events rather than several timers racing to the same finish line.
const T = {
  you: 0,
  broker: 500,
  dot1: 650,
  dot1Duration: 550,
  exchange: 1350,
  dot2: 1500,
  dot2Duration: 600,
  seller: 2250,
  dot3: 2500,
  dot3Duration: 550,
  matched: 3150,
};
const SEQUENCE_END = T.matched + 600; // final state stays visible before signaling completion

export default function BuyScene({
  play,
  reduceMotion,
  isMobile = false,
  onComplete,
}: {
  play: boolean;
  reduceMotion: boolean;
  isMobile?: boolean;
  onComplete?: () => void;
}) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (!play) return;
    firedRef.current = false;

    if (reduceMotion) {
      // Reduced motion: the whole diagram is already fully visible via the
      // `reduceMotion` branches below -- signal completion right away rather
      // than waiting through timings the learner never sees play out.
      if (!firedRef.current) {
        firedRef.current = true;
        onComplete?.();
      }
      return;
    }

    const t = setTimeout(() => {
      if (!firedRef.current) {
        firedRef.current = true;
        onComplete?.();
      }
    }, SEQUENCE_END);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, reduceMotion]);

  const NODES = isMobile ? MOBILE_NODES : DESKTOP_NODES;
  const PATHS = isMobile ? MOBILE_PATHS : DESKTOP_PATHS;
  const STAMP = isMobile ? MOBILE_MATCH_STAMP : DESKTOP_MATCH_STAMP;
  const LABELS = isMobile ? MOBILE_LABELS : DESKTOP_LABELS;

  // --- SKETCH layer: only the connecting arrows get the hand-drawn filter ---
  const sketch = (
    <>
      <DrawPath d={PATHS.youToBroker} play={play} delay={T.dot1} duration={280} reduceMotion={reduceMotion} />
      <DrawPath d={PATHS.brokerToExchange} play={play} delay={T.dot2} duration={320} reduceMotion={reduceMotion} />
      <DrawPath d={PATHS.sellerToExchange} play={play} delay={T.dot3} duration={300} reduceMotion={reduceMotion} />
    </>
  );

  // --- CRISP layer: everything a learner needs to actually read ---
  const crisp = (
    <>
      <Node key={NODES[0].id} {...NODES[0]} visible={play} delay={T.you} reduceMotion={reduceMotion} />
      <Node key={NODES[1].id} {...NODES[1]} visible={play} delay={T.broker} reduceMotion={reduceMotion} />
      <Node key={NODES[2].id} {...NODES[2]} visible={play} delay={T.exchange} reduceMotion={reduceMotion} />
      <Node
        key={NODES[3].id}
        {...NODES[3]}
        visible={play}
        delay={T.seller}
        reduceMotion={reduceMotion}
        dim={!reduceMotion}
      />

      <MovingDot d={PATHS.youToBroker} play={play} delay={T.dot1} duration={T.dot1Duration} reduceMotion={reduceMotion} />
      <PathLabel {...LABELS.buy} text="BUY" visible={play} delay={T.dot1} reduceMotion={reduceMotion} />

      <MovingDot d={PATHS.brokerToExchange} play={play} delay={T.dot2} duration={T.dot2Duration} reduceMotion={reduceMotion} />
      {!isMobile && (
        <PathLabel {...DESKTOP_LABELS.buyOrder} text="BUY ORDER" visible={play} delay={T.dot2} reduceMotion={reduceMotion} />
      )}

      <MovingDot d={PATHS.sellerToExchange} play={play} delay={T.dot3} duration={T.dot3Duration} reduceMotion={reduceMotion} />
      <PathLabel {...LABELS.sell} text="SELL" visible={play} delay={T.dot3} reduceMotion={reduceMotion} />

      {/* The match itself -- the moment both orders have arrived */}
      <MatchedStamp x={STAMP.x} y={STAMP.y} visible={play} delay={T.matched} reduceMotion={reduceMotion} />
    </>
  );

  return { sketch, crisp };
}
