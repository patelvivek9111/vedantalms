/**
 * Derives full Tailwind-style color ramps from a single institution brand color.
 *
 * The app has ~2,000 hardcoded `blue-*`/`indigo-*`/`violet-*`/`purple-*` classes.
 * Rather than rewrite every call site, `tailwind.config.js` points those families
 * at the CSS variables produced here, so the whole shell follows the Theme Editor.
 */

export const DEFAULT_BRAND_PRIMARY = '#4F46E5';
export const DEFAULT_BRAND_SECONDARY = '#7C3AED';

export const RAMP_STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

export type RampStop = (typeof RAMP_STOPS)[number];
export type Ramp = Record<RampStop, string>;

/** The stop a brand color is treated as; Tailwind's `-600` is the app's default action color. */
const ANCHOR: RampStop = 600;

/**
 * Reference ramps supply the lightness/saturation curve. Feeding the anchor color
 * of a reference back in reproduces that reference exactly, so the default theme
 * still renders stock Tailwind indigo/violet.
 */
const PRIMARY_REFERENCE: Ramp = {
  50: '#eef2ff',
  100: '#e0e7ff',
  200: '#c7d2fe',
  300: '#a5b4fc',
  400: '#818cf8',
  500: '#6366f1',
  600: '#4f46e5',
  700: '#4338ca',
  800: '#3730a3',
  900: '#312e81',
  950: '#1e1b4b',
};

const SECONDARY_REFERENCE: Ramp = {
  50: '#f5f3ff',
  100: '#ede9fe',
  200: '#ddd6fe',
  300: '#c4b5fd',
  400: '#a78bfa',
  500: '#8b5cf6',
  600: '#7c3aed',
  700: '#6d28d9',
  800: '#5b21b6',
  900: '#4c1d95',
  950: '#2e1065',
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const SHORT_HEX = /^#[0-9a-f]{3}$/i;

type Rgb = { r: number; g: number; b: number };
type Hsl = { h: number; s: number; l: number };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Accepts `#abc` and `#aabbcc`; anything else falls back to the caller's default. */
export function normalizeHex(value: string | undefined, fallback: string): string {
  const trimmed = (value || '').trim();
  if (SHORT_HEX.test(trimmed)) {
    return `#${trimmed
      .slice(1)
      .split('')
      .map((c) => c + c)
      .join('')}`.toLowerCase();
  }
  return HEX_COLOR.test(trimmed) ? trimmed.toLowerCase() : fallback.toLowerCase();
}

function hexToRgb(hex: string): Rgb {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const l = (max + min) / 2;

  if (delta === 0) return { h: 0, s: 0, l };

  const s = delta / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / delta) % 6;
  else if (max === gn) h = (bn - rn) / delta + 2;
  else h = (rn - gn) / delta + 4;

  return { h: (h * 60 + 360) % 360, s, l };
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const m = l - c / 2;

  let rgb: [number, number, number];
  if (hp < 1) rgb = [c, x, 0];
  else if (hp < 2) rgb = [x, c, 0];
  else if (hp < 3) rgb = [0, c, x];
  else if (hp < 4) rgb = [0, x, c];
  else if (hp < 5) rgb = [x, 0, c];
  else rgb = [c, 0, x];

  return {
    r: Math.round(clamp((rgb[0] + m) * 255, 0, 255)),
    g: Math.round(clamp((rgb[1] + m) * 255, 0, 255)),
    b: Math.round(clamp((rgb[2] + m) * 255, 0, 255)),
  };
}

/**
 * Rescales the reference lightness curve so the anchor lands exactly on the brand
 * color, and stops on either side stretch toward white/black instead of clipping.
 */
function remapLightness(refL: number, anchorRefL: number, brandL: number): number {
  if (refL >= anchorRefL) {
    const headroom = 1 - anchorRefL;
    if (headroom <= 0) return brandL;
    return brandL + (refL - anchorRefL) * ((1 - brandL) / headroom);
  }
  if (anchorRefL <= 0) return brandL;
  return brandL * (refL / anchorRefL);
}

function buildRamp(brandHex: string, reference: Ramp): Ramp {
  const brand = rgbToHsl(hexToRgb(brandHex));
  const anchor = rgbToHsl(hexToRgb(reference[ANCHOR]));
  const satScale = anchor.s === 0 ? 1 : brand.s / anchor.s;

  return RAMP_STOPS.reduce((acc, stop) => {
    const ref = rgbToHsl(hexToRgb(reference[stop]));
    const { r, g, b } = hslToRgb({
      h: brand.h + (ref.h - anchor.h),
      s: clamp(ref.s * satScale, 0, 1),
      l: clamp(remapLightness(ref.l, anchor.l, brand.l), 0, 1),
    });
    acc[stop] = `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
    return acc;
  }, {} as Ramp);
}

/** Tailwind consumes these as `rgb(var(--brand-600) / <alpha-value>)`, so emit bare channels. */
export function toChannels(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `${r} ${g} ${b}`;
}

/** Readable foreground for text sitting on a brand-filled surface. */
export function contrastOn(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const linear = [r, g, b]
    .map((c) => c / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  return luminance > 0.55 ? '#0f172a' : '#ffffff';
}

export type BrandPalette = {
  primary: string;
  secondary: string;
  primaryRamp: Ramp;
  secondaryRamp: Ramp;
  /** CSS custom property name -> value, ready to write onto :root. */
  variables: Record<string, string>;
};

export function buildBrandPalette(
  primaryColor: string | undefined,
  secondaryColor: string | undefined
): BrandPalette {
  const primary = normalizeHex(primaryColor, DEFAULT_BRAND_PRIMARY);
  const secondary = normalizeHex(secondaryColor, DEFAULT_BRAND_SECONDARY);
  const primaryRamp = buildRamp(primary, PRIMARY_REFERENCE);
  const secondaryRamp = buildRamp(secondary, SECONDARY_REFERENCE);

  const variables: Record<string, string> = {
    '--brand-primary': primary,
    '--brand-primary-hover': primaryRamp[700],
    '--brand-primary-soft': primaryRamp[50],
    '--brand-primary-contrast': contrastOn(primary),
    '--brand-secondary': secondary,
    '--brand-secondary-contrast': contrastOn(secondary),
  };

  RAMP_STOPS.forEach((stop) => {
    variables[`--brand-${stop}`] = toChannels(primaryRamp[stop]);
    variables[`--brand-secondary-${stop}`] = toChannels(secondaryRamp[stop]);
  });

  return { primary, secondary, primaryRamp, secondaryRamp, variables };
}
