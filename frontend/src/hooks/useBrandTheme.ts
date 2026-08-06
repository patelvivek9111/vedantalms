import { useEffect, useMemo } from 'react';
import { getImageUrl } from '../services/api';
import { buildBrandPalette } from '../utils/brandPalette';
import type { TenantBrand } from '../contexts/TenantContext';

export {
  DEFAULT_BRAND_PRIMARY,
  DEFAULT_BRAND_SECONDARY,
} from '../utils/brandPalette';

function applyFavicon(href: string) {
  if (typeof document === 'undefined') return;
  const existing = document.querySelectorAll<HTMLLinkElement>('link[data-brand-favicon="true"]');
  existing.forEach((node) => node.remove());
  if (!href) {
    document
      .querySelectorAll<HTMLLinkElement>('link[data-brand-favicon-hidden="true"]')
      .forEach((node) => {
        node.removeAttribute('data-brand-favicon-hidden');
        node.rel = 'icon';
      });
    return;
  }

  // Park the static icons rather than deleting them, so clearing the brand restores defaults.
  document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]').forEach((node) => {
    node.setAttribute('data-brand-favicon-hidden', 'true');
    node.rel = 'alternate icon';
  });

  const link = document.createElement('link');
  link.rel = 'icon';
  link.href = href;
  link.setAttribute('data-brand-favicon', 'true');
  document.head.appendChild(link);
}

/**
 * Publishes institution branding as CSS variables + favicon so the whole shell
 * follows the school's Theme Editor settings.
 */
export function useBrandTheme(brand: TenantBrand | undefined) {
  const primaryColor = brand?.primaryColor;
  const secondaryColor = brand?.secondaryColor;
  const faviconUrl = brand?.faviconUrl || '';

  const palette = useMemo(
    () => buildBrandPalette(primaryColor, secondaryColor),
    [primaryColor, secondaryColor]
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    Object.entries(palette.variables).forEach(([name, value]) => {
      root.style.setProperty(name, value);
    });

    // Keeps mobile browser chrome in step with the rest of the shell.
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeColor) themeColor.content = palette.primary;
  }, [palette]);

  useEffect(() => {
    applyFavicon(faviconUrl ? getImageUrl(faviconUrl, { width: 64 }) : '');
  }, [faviconUrl]);
}
