import { describe, it, expect } from 'vitest';
import {
  buildBrandPalette,
  contrastOn,
  normalizeHex,
  DEFAULT_BRAND_PRIMARY,
  DEFAULT_BRAND_SECONDARY,
} from '../../../src/utils/brandPalette';

const TAILWIND_INDIGO = {
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

const TAILWIND_VIOLET = {
  600: '#7c3aed',
  50: '#f5f3ff',
  950: '#2e1065',
};

/** Hex channels can drift by a bit through HSL round-tripping. */
function expectClose(actual: string, expected: string, tolerance = 2) {
  const channels = (hex: string) =>
    [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
  channels(actual).forEach((value, index) => {
    expect(Math.abs(value - channels(expected)[index])).toBeLessThanOrEqual(tolerance);
  });
}

describe('brandPalette', () => {
  it('reproduces stock Tailwind indigo when the brand is the default primary', () => {
    const { primaryRamp } = buildBrandPalette(DEFAULT_BRAND_PRIMARY, DEFAULT_BRAND_SECONDARY);
    Object.entries(TAILWIND_INDIGO).forEach(([stop, hex]) => {
      expectClose(primaryRamp[Number(stop) as keyof typeof primaryRamp], hex);
    });
  });

  it('reproduces stock Tailwind violet when the brand is the default secondary', () => {
    const { secondaryRamp } = buildBrandPalette(DEFAULT_BRAND_PRIMARY, DEFAULT_BRAND_SECONDARY);
    Object.entries(TAILWIND_VIOLET).forEach(([stop, hex]) => {
      expectClose(secondaryRamp[Number(stop) as keyof typeof secondaryRamp], hex);
    });
  });

  it('anchors the 600 stop exactly on the chosen brand color', () => {
    const { primaryRamp, secondaryRamp } = buildBrandPalette('#c81e1e', '#0f766e');
    expectClose(primaryRamp[600], '#c81e1e', 1);
    expectClose(secondaryRamp[600], '#0f766e', 1);
  });

  it('keeps the ramp ordered from light to dark for an arbitrary brand color', () => {
    const { primaryRamp } = buildBrandPalette('#0d9488', undefined);
    const luminance = (hex: string) =>
      [1, 3, 5].reduce((sum, start) => sum + parseInt(hex.slice(start, start + 2), 16), 0);

    const stops = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
    stops.slice(1).forEach((stop, index) => {
      expect(luminance(primaryRamp[stop])).toBeLessThan(luminance(primaryRamp[stops[index]]));
    });
  });

  it('emits bare RGB channels so Tailwind opacity modifiers work', () => {
    const { variables } = buildBrandPalette(DEFAULT_BRAND_PRIMARY, DEFAULT_BRAND_SECONDARY);
    expect(variables['--brand-600']).toBe('79 70 229');
    expect(variables['--brand-secondary-600']).toBe('124 58 237');
    expect(variables['--brand-primary']).toBe('#4f46e5');
  });

  it('falls back to defaults for malformed colors and expands shorthand hex', () => {
    expect(normalizeHex('nope', DEFAULT_BRAND_PRIMARY)).toBe('#4f46e5');
    expect(normalizeHex('#0a0', DEFAULT_BRAND_PRIMARY)).toBe('#00aa00');
    expect(buildBrandPalette('', '').primary).toBe('#4f46e5');
  });

  it('picks a readable foreground for light and dark brand colors', () => {
    expect(contrastOn('#facc15')).toBe('#0f172a');
    expect(contrastOn('#1e1b4b')).toBe('#ffffff');
  });
});
