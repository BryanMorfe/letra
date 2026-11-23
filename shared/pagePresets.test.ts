import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PAGE_SETTINGS,
  formatHeaderFooterToken,
  getResolvedPageSizeMm,
  mmToUnit,
  unitToMm,
} from './pagePresets';

describe('pagePresets utilities', () => {
  it('resolves portrait and landscape dimensions accurately', () => {
    const portrait = getResolvedPageSizeMm({ ...DEFAULT_PAGE_SETTINGS, preset: 'a4', orientation: 'portrait' });
    expect(portrait).toEqual({ widthMm: 210, heightMm: 297 });

    const landscape = getResolvedPageSizeMm({ ...DEFAULT_PAGE_SETTINGS, preset: 'a4', orientation: 'landscape' });
    expect(landscape).toEqual({ widthMm: 297, heightMm: 210 });
  });

  it('supports custom paper dimensions and unit conversions', () => {
    const custom = getResolvedPageSizeMm({
      ...DEFAULT_PAGE_SETTINGS,
      preset: 'custom',
      customWidthMm: 150,
      customHeightMm: 220,
    });
    expect(custom).toEqual({ widthMm: 150, heightMm: 220 });

    expect(mmToUnit(25.4, 'in')).toBe(1);
    expect(unitToMm(1, 'in')).toBeCloseTo(25.4, 3);
  });

  it('formats header/footer tokens cleanly', () => {
    const formatted = formatHeaderFooterToken('{title} — Page {page} of {pages} ({date})', {
      title: 'Annual Report',
      page: 2,
      pages: 5,
      date: 'Nov 22, 2026',
    });
    expect(formatted).toBe('Annual Report — Page 2 of 5 (Nov 22, 2026)');
  });
});
