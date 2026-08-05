import React, { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, RefreshCw, Save, Trash2, Upload } from 'lucide-react';
import api, { getImageUrl } from '../../services/api';
import { useTenant } from '../../contexts/TenantContext';
import {
  DEFAULT_BRAND_PRIMARY,
  DEFAULT_BRAND_SECONDARY,
} from '../../hooks/useBrandTheme';

type BrandAssetKind = 'logo' | 'favicon' | 'loginBackground';

interface Brand {
  displayName: string;
  wordmark: string;
  logoUrl: string;
  faviconUrl: string;
  loginBackgroundUrl: string;
  loginTagline: string;
  primaryColor: string;
  secondaryColor: string;
}

const EMPTY_BRAND: Brand = {
  displayName: '',
  wordmark: '',
  logoUrl: '',
  faviconUrl: '',
  loginBackgroundUrl: '',
  loginTagline: '',
  primaryColor: DEFAULT_BRAND_PRIMARY,
  secondaryColor: DEFAULT_BRAND_SECONDARY,
};

const ASSETS: Array<{
  kind: BrandAssetKind;
  field: keyof Brand;
  label: string;
  help: string;
  preview: 'square' | 'wide';
}> = [
  {
    kind: 'logo',
    field: 'logoUrl',
    label: 'Institution logo',
    help: 'Shown in the global navigation and on the sign-in card. Square PNG or SVG works best.',
    preview: 'square',
  },
  {
    kind: 'favicon',
    field: 'faviconUrl',
    label: 'Favicon',
    help: 'Browser tab icon. A 32x32 or 48x48 PNG is ideal.',
    preview: 'square',
  },
  {
    kind: 'loginBackground',
    field: 'loginBackgroundUrl',
    label: 'Login background',
    help: 'Full-bleed image behind the sign-in page. Wide, low-contrast photos read best.',
    preview: 'wide',
  },
];

const inputClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent';

function ColorField({
  id,
  label,
  help,
  value,
  onChange,
}: {
  id: string;
  label: string;
  help: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      <div className="flex items-center gap-3">
        <input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-14 shrink-0 cursor-pointer rounded border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          aria-label={`${label} hex value`}
          className={`${inputClass} font-mono uppercase`}
        />
      </div>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{help}</p>
    </div>
  );
}

export default function BrandingSettingsTab() {
  const { refresh: refreshTenant } = useTenant();
  const [brand, setBrand] = useState<Brand>(EMPTY_BRAND);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyAsset, setBusyAsset] = useState<BrandAssetKind | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputs = useRef<Partial<Record<BrandAssetKind, HTMLInputElement | null>>>({});

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await api.get('/admin/branding');
        if (active && res.data?.success) {
          setBrand({ ...EMPTY_BRAND, ...res.data.data });
        }
      } catch {
        if (active) setMessage({ type: 'error', text: 'Could not load branding settings.' });
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [message]);

  const applyBrand = async (next: Brand, text: string) => {
    setBrand({ ...EMPTY_BRAND, ...next });
    setMessage({ type: 'success', text });
    // Repull the tenant so the shell, favicon and login page pick up the change now.
    await refreshTenant();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.put('/admin/branding', {
        primaryColor: brand.primaryColor,
        secondaryColor: brand.secondaryColor,
        wordmark: brand.wordmark,
        loginTagline: brand.loginTagline,
      });
      await applyBrand(res.data.data, 'Branding saved.');
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.response?.data?.message || 'Could not save branding.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (kind: BrandAssetKind, file: File) => {
    setBusyAsset(kind);
    try {
      const formData = new FormData();
      formData.append('asset', file);
      const res = await api.post(`/admin/branding/assets/${kind}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await applyBrand(res.data.data, 'Image uploaded.');
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.response?.data?.message || 'Could not upload image.',
      });
    } finally {
      setBusyAsset(null);
      const input = fileInputs.current[kind];
      if (input) input.value = '';
    }
  };

  const handleRemove = async (kind: BrandAssetKind) => {
    setBusyAsset(kind);
    try {
      const res = await api.delete(`/admin/branding/assets/${kind}`);
      await applyBrand(res.data.data, 'Image removed.');
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.response?.data?.message || 'Could not remove image.',
      });
    } finally {
      setBusyAsset(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 p-10 text-sm text-gray-500 dark:text-gray-400">
        <RefreshCw className="h-4 w-4 animate-spin" />
        Loading branding…
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Branding</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Colors, logos and sign-in styling for {brand.displayName || 'your institution'}. Changes
          apply to everyone in this institution.
        </p>
      </div>

      {message && (
        <div
          role="status"
          className={`rounded-lg border px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <section className="space-y-4">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Colors
        </h4>
        <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
          <ColorField
            id="brand-primary"
            label="Primary color"
            help="Buttons, links and active navigation."
            value={brand.primaryColor}
            onChange={(primaryColor) => setBrand((prev) => ({ ...prev, primaryColor }))}
          />
          <ColorField
            id="brand-secondary"
            label="Secondary color"
            help="Accents and gradients that pair with the primary color."
            value={brand.secondaryColor}
            onChange={(secondaryColor) => setBrand((prev) => ({ ...prev, secondaryColor }))}
          />
        </div>

        <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Preview
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              style={{ backgroundColor: brand.primaryColor }}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm"
            >
              Primary button
            </button>
            <span style={{ color: brand.primaryColor }} className="text-sm font-medium underline">
              Example link
            </span>
            <span
              className="h-8 w-24 rounded-lg"
              style={{
                backgroundImage: `linear-gradient(90deg, ${brand.primaryColor}, ${brand.secondaryColor})`,
              }}
              aria-hidden
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Sign-in page
        </h4>
        <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
          <div>
            <label htmlFor="brand-wordmark" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Wordmark
            </label>
            <input
              id="brand-wordmark"
              type="text"
              maxLength={40}
              value={brand.wordmark}
              onChange={(e) => setBrand((prev) => ({ ...prev, wordmark: e.target.value }))}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Short name shown under the logo on the sign-in card.
            </p>
          </div>
          <div>
            <label htmlFor="brand-tagline" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Sign-in tagline
            </label>
            <input
              id="brand-tagline"
              type="text"
              maxLength={160}
              value={brand.loginTagline}
              onChange={(e) => setBrand((prev) => ({ ...prev, loginTagline: e.target.value }))}
              placeholder="Welcome back"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Optional line of welcome text above the sign-in form.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Images
        </h4>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {ASSETS.map(({ kind, field, label, help, preview }) => {
            const value = String(brand[field] || '');
            const busy = busyAsset === kind;
            return (
              <div
                key={kind}
                className="flex flex-col rounded-lg border border-gray-200 p-4 dark:border-gray-700"
              >
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{help}</p>

                <div
                  className={`mt-3 flex items-center justify-center overflow-hidden rounded-lg border border-dashed border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-900 ${
                    preview === 'wide' ? 'h-24' : 'h-24 w-24 self-start'
                  }`}
                >
                  {value ? (
                    <img
                      src={getImageUrl(value)}
                      alt={`${label} preview`}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-gray-300 dark:text-gray-600" strokeWidth={1.5} />
                  )}
                </div>

                <input
                  ref={(node) => {
                    fileInputs.current[kind] = node;
                  }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleUpload(kind, file);
                  }}
                />

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => fileInputs.current[kind]?.click()}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    {busy ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    {value ? 'Replace' : 'Upload'}
                  </button>
                  {value && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleRemove(kind)}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-transparent px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex justify-end border-t border-gray-200 pt-4 dark:border-gray-700">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving…' : 'Save branding'}
        </button>
      </div>
    </div>
  );
}
