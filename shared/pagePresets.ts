import type { LengthUnit, PageMarginsMm, PagePresetId, PageSettings } from './types';

export interface PagePresetDefinition {
  id: PagePresetId;
  label: string;
  shortLabel: string;
  widthMm: number;
  heightMm: number;
  region: string;
}

export const MM_PER_INCH = 25.4;
export const CSS_PX_PER_INCH = 96;
export const CSS_PX_PER_MM = CSS_PX_PER_INCH / MM_PER_INCH;

export const PAGE_PRESETS: Record<Exclude<PagePresetId, 'custom'>, PagePresetDefinition> = {
  letter: {
    id: 'letter',
    label: 'US Letter',
    shortLabel: 'Letter',
    widthMm: 215.9,
    heightMm: 279.4,
    region: '8.5 × 11 in',
  },
  legal: {
    id: 'legal',
    label: 'US Legal',
    shortLabel: 'Legal',
    widthMm: 215.9,
    heightMm: 355.6,
    region: '8.5 × 14 in',
  },
  a4: {
    id: 'a4',
    label: 'A4',
    shortLabel: 'A4',
    widthMm: 210,
    heightMm: 297,
    region: '210 × 297 mm',
  },
  a5: {
    id: 'a5',
    label: 'A5',
    shortLabel: 'A5',
    widthMm: 148,
    heightMm: 210,
    region: '148 × 210 mm',
  },
  b5: {
    id: 'b5',
    label: 'B5 (ISO)',
    shortLabel: 'B5',
    widthMm: 176,
    heightMm: 250,
    region: '176 × 250 mm',
  },
  executive: {
    id: 'executive',
    label: 'Executive',
    shortLabel: 'Exec',
    widthMm: 184.15,
    heightMm: 266.7,
    region: '7.25 × 10.5 in',
  },
};

export interface MarginPreset {
  id: string;
  label: string;
  margins: Omit<PageMarginsMm, 'linked'>;
}

export const MARGIN_PRESETS: MarginPreset[] = [
  { id: 'normal', label: 'Normal (25.4 mm)', margins: { top: 25.4, right: 25.4, bottom: 25.4, left: 25.4 } },
  { id: 'narrow', label: 'Narrow (12.7 mm)', margins: { top: 12.7, right: 12.7, bottom: 12.7, left: 12.7 } },
  { id: 'moderate', label: 'Moderate (25.4 × 19.1 mm)', margins: { top: 25.4, right: 19.05, bottom: 25.4, left: 19.05 } },
  { id: 'wide', label: 'Wide (25.4 × 38.1 mm)', margins: { top: 25.4, right: 38.1, bottom: 25.4, left: 38.1 } },
];

export const DEFAULT_PAGE_SETTINGS: PageSettings = {
  preset: 'letter',
  orientation: 'portrait',
  unit: 'in',
  customWidthMm: 215.9,
  customHeightMm: 279.4,
  marginsMm: {
    top: 25.4,
    right: 25.4,
    bottom: 25.4,
    left: 25.4,
    linked: true,
  },
  showHeader: true,
  showFooter: true,
  header: {
    left: '{title}',
    center: '',
    right: '{date}',
  },
  footer: {
    left: '',
    center: 'Page {page} of {pages}',
    right: '',
  },
  differentFirstPage: true,
  zoom: 'fit-width',
  typography: 'editorial',
  fontSizePx: 14.5,
};

export function getResolvedPageSizeMm(settings: PageSettings): { widthMm: number; heightMm: number } {
  const base =
    settings.preset === 'custom'
      ? { widthMm: Math.max(50, settings.customWidthMm), heightMm: Math.max(50, settings.customHeightMm) }
      : PAGE_PRESETS[settings.preset];

  if (settings.orientation === 'landscape') {
    return { widthMm: base.heightMm, heightMm: base.widthMm };
  }
  return { widthMm: base.widthMm, heightMm: base.heightMm };
}

export function getResolvedPageSizePx(settings: PageSettings): { widthPx: number; heightPx: number } {
  const { widthMm, heightMm } = getResolvedPageSizeMm(settings);
  return {
    widthPx: Math.round(widthMm * CSS_PX_PER_MM),
    heightPx: Math.round(heightMm * CSS_PX_PER_MM),
  };
}

export function mmToUnit(mm: number, unit: LengthUnit): number {
  const value = unit === 'in' ? mm / MM_PER_INCH : mm;
  return Number(value.toFixed(unit === 'in' ? 2 : 1));
}

export function unitToMm(value: number, unit: LengthUnit): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return unit === 'in' ? value * MM_PER_INCH : value;
}

export function formatHeaderFooterToken(
  template: string,
  vars: { title: string; page: number; pages: number; date: string }
): string {
  if (!template) return '';
  return template
    .replace(/\{title\}/gi, vars.title)
    .replace(/\{page\}/gi, String(vars.page))
    .replace(/\{pages\}/gi, String(vars.pages))
    .replace(/\{date\}/gi, vars.date);
}
