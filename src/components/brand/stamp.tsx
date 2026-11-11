import { cn } from "@/lib/utils";

/**
 * Shared SVG filter that roughens edges and knocks out small ink speckles,
 * so a stamp looks pressed rather than drawn. Rendered once in the root layout.
 */
export function StampDefs() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="0"
      height="0"
      className="pointer-events-none absolute size-0"
    >
      <defs>
        <filter id="stamp-ink" x="-4%" y="-8%" width="108%" height="116%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves="3"
            seed="8"
            result="noise"
          />
          <feColorMatrix
            in="noise"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -10 0 0 0 8.3"
            result="speck"
          />
          <feComposite in="SourceGraphic" in2="speck" operator="in" result="inked" />
          <feDisplacementMap in="inked" in2="noise" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}

const TONES = {
  vermilion: "text-primary",
  green: "text-success",
  ink: "text-foreground",
} as const;

const SIZES = {
  sm: "px-2 py-0.5 text-[0.6875rem] border-2 tracking-[0.14em]",
  md: "px-3 py-1 text-sm border-[3px] tracking-[0.16em]",
  lg: "px-4 py-1.5 text-xl border-4 tracking-[0.16em] sm:text-2xl",
} as const;

interface StampProps {
  children: React.ReactNode;
  tone?: keyof typeof TONES;
  size?: keyof typeof SIZES;
  /** Degrees. Stamps are never perfectly square to the page. */
  rotate?: number;
  /** Set when the stamp repeats text already available to assistive tech. */
  decorative?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/** A rubber stamp: EXTRACTED, NOT AN INVOICE, DUPLICATE. */
export function Stamp({
  children,
  tone = "vermilion",
  size = "md",
  rotate = -5,
  decorative = false,
  className,
  style,
}: StampProps) {
  return (
    <span
      aria-hidden={decorative || undefined}
      className={cn(
        "pointer-events-none inline-flex w-fit select-none items-center justify-center rounded-[3px] border-current font-display font-extrabold uppercase leading-none whitespace-nowrap [filter:url(#stamp-ink)]",
        TONES[tone],
        SIZES[size],
        className
      )}
      style={{ transform: `rotate(${rotate}deg)`, ...style }}
    >
      {children}
    </span>
  );
}
