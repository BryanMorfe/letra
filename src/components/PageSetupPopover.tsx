import React, { useState } from 'react';
import { Link2, Link2Off, X } from 'lucide-react';
import {
  MARGIN_PRESETS,
  PAGE_PRESETS,
  getResolvedPageSizeMm,
  mmToUnit,
  unitToMm,
} from '../../shared/pagePresets';
import type {
  LengthUnit,
  PagePresetId,
  PageSettings,
  TypographyStyle,
} from '../../shared/types';

interface PageSetupPopoverProps {
  settings: PageSettings;
  onChange: (next: PageSettings) => void;
  forceWhitePaper: boolean;
  onToggleForceWhitePaper: (val: boolean) => void;
  isDarkTheme: boolean;
  onClose: () => void;
}

type InspectorTab = 'layout' | 'header-footer' | 'typography';

const TOKENS = ['{title}', '{date}', '{page}', '{pages}'];

export const PageSetupPopover: React.FC<PageSetupPopoverProps> = ({
  settings,
  onChange,
  forceWhitePaper,
  onToggleForceWhitePaper,
  isDarkTheme,
  onClose,
}) => {
  const [tab, setTab] = useState<InspectorTab>('layout');
  const [focusedSlot, setFocusedSlot] = useState<{
    section: 'header' | 'footer';
    slot: 'left' | 'center' | 'right';
  } | null>(null);

  const resolvedMm = getResolvedPageSizeMm(settings);
  const unit = settings.unit;

  const updateMargin = (side: 'top' | 'right' | 'bottom' | 'left', rawVal: string) => {
    const num = parseFloat(rawVal);
    if (Number.isNaN(num) || num < 0) return;
    const mm = Math.min(80, unitToMm(num, unit));
    if (settings.marginsMm.linked) {
      onChange({
        ...settings,
        marginsMm: { ...settings.marginsMm, top: mm, right: mm, bottom: mm, left: mm },
      });
    } else {
      onChange({
        ...settings,
        marginsMm: { ...settings.marginsMm, [side]: mm },
      });
    }
  };

  const handleCustomDimension = (axis: 'width' | 'height', rawVal: string) => {
    const num = parseFloat(rawVal);
    if (Number.isNaN(num) || num <= 0) return;
    const mm = Math.max(60, Math.min(600, unitToMm(num, unit)));
    const baseW = settings.preset === 'custom' ? settings.customWidthMm : PAGE_PRESETS[settings.preset].widthMm;
    const baseH = settings.preset === 'custom' ? settings.customHeightMm : PAGE_PRESETS[settings.preset].heightMm;
    onChange({
      ...settings,
      preset: 'custom',
      customWidthMm: axis === 'width' ? mm : baseW,
      customHeightMm: axis === 'height' ? mm : baseH,
    });
  };

  const insertToken = (token: string) => {
    const target = focusedSlot || { section: 'footer', slot: 'center' };
    const current = settings[target.section][target.slot];
    onChange({
      ...settings,
      [target.section]: {
        ...settings[target.section],
        [target.slot]: current ? `${current} ${token}` : token,
      },
    });
  };

  const presetList: Array<{ id: PagePresetId; label: string; sub: string }> = [
    ...Object.values(PAGE_PRESETS).map((p) => ({
      id: p.id as PagePresetId,
      label: p.label,
      sub: p.region,
    })),
    { id: 'custom', label: 'Custom', sub: 'Any size' },
  ];

  return (
    <div
      className="w-[360px] rounded-xl border border-[var(--letra-border)] bg-[var(--letra-elevated)] shadow-2xl text-[var(--letra-fg)] overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--letra-border)]">
        <span className="text-xs font-semibold tracking-wide uppercase text-[var(--letra-muted)]">
          Page Setup
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-[var(--letra-muted)] hover:text-[var(--letra-fg)] hover:bg-[var(--letra-hover)] cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Sub-tabs */}
      <div className="grid grid-cols-3 gap-1 p-1.5 border-b border-[var(--letra-border)] bg-[var(--letra-surface)]/50">
        {(
          [
            ['layout', 'Paper & Margins'],
            ['header-footer', 'Header & Footer'],
            ['typography', 'Typography'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
              tab === id
                ? 'bg-[var(--letra-elevated)] text-[var(--letra-fg)] shadow-xs ring-1 ring-[var(--letra-border)]'
                : 'text-[var(--letra-muted)] hover:text-[var(--letra-fg)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4 max-h-[72vh] overflow-y-auto">
        {tab === 'layout' && (
          <>
            {/* Paper Presets */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-[var(--letra-fg)]">Paper Size</label>
                <div className="inline-flex rounded-md border border-[var(--letra-border)] p-0.5 bg-[var(--letra-surface)]">
                  {(['in', 'mm'] as LengthUnit[]).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => onChange({ ...settings, unit: u })}
                      className={`px-2 py-0.5 text-[11px] rounded font-medium cursor-pointer ${
                        unit === u
                          ? 'bg-indigo-500 text-white'
                          : 'text-[var(--letra-muted)] hover:text-[var(--letra-fg)]'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {presetList.map((preset) => {
                  const active = settings.preset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => onChange({ ...settings, preset: preset.id })}
                      className={`flex flex-col items-start px-2.5 py-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                        active
                          ? 'border-indigo-500 bg-indigo-500/10 text-[var(--letra-fg)]'
                          : 'border-[var(--letra-border)] hover:bg-[var(--letra-hover)] text-[var(--letra-fg)]'
                      }`}
                    >
                      <span className="text-xs font-medium">{preset.label}</span>
                      <span className="text-[10px] text-[var(--letra-muted)]">{preset.sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dimensions & Orientation */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-[var(--letra-muted)] mb-1">
                  Width ({unit})
                </label>
                <input
                  type="number"
                  step={unit === 'in' ? '0.1' : '1'}
                  min={unit === 'in' ? '3' : '75'}
                  max={unit === 'in' ? '24' : '600'}
                  value={mmToUnit(resolvedMm.widthMm, unit)}
                  onChange={(e) => handleCustomDimension('width', e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[var(--letra-border)] bg-[var(--letra-input-bg)] text-[var(--letra-fg)] focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--letra-muted)] mb-1">
                  Height ({unit})
                </label>
                <input
                  type="number"
                  step={unit === 'in' ? '0.1' : '1'}
                  min={unit === 'in' ? '3' : '75'}
                  max={unit === 'in' ? '24' : '600'}
                  value={mmToUnit(resolvedMm.heightMm, unit)}
                  onChange={(e) => handleCustomDimension('height', e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[var(--letra-border)] bg-[var(--letra-input-bg)] text-[var(--letra-fg)] focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Orientation</span>
              <div className="inline-flex rounded-lg border border-[var(--letra-border)] p-0.5 bg-[var(--letra-surface)]">
                {(['portrait', 'landscape'] as const).map((ori) => (
                  <button
                    key={ori}
                    type="button"
                    onClick={() => onChange({ ...settings, orientation: ori })}
                    className={`px-3 py-1 rounded-md text-xs capitalize font-medium cursor-pointer ${
                      settings.orientation === ori
                        ? 'bg-[var(--letra-elevated)] text-[var(--letra-fg)] shadow-xs'
                        : 'text-[var(--letra-muted)] hover:text-[var(--letra-fg)]'
                    }`}
                  >
                    {ori}
                  </button>
                ))}
              </div>
            </div>

            {/* Margins */}
            <div className="space-y-2 pt-2 border-t border-[var(--letra-border)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Margins ({unit})</span>
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...settings,
                      marginsMm: { ...settings.marginsMm, linked: !settings.marginsMm.linked },
                    })
                  }
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-[var(--letra-muted)] hover:text-[var(--letra-fg)] hover:bg-[var(--letra-hover)] cursor-pointer"
                  title={settings.marginsMm.linked ? 'Unlink margins' : 'Link all margins'}
                >
                  {settings.marginsMm.linked ? (
                    <>
                      <Link2 className="w-3 h-3 text-indigo-500" /> Linked
                    </>
                  ) : (
                    <>
                      <Link2Off className="w-3 h-3" /> Independent
                    </>
                  )}
                </button>
              </div>

              <div className="flex flex-wrap gap-1">
                {MARGIN_PRESETS.map((mp) => (
                  <button
                    key={mp.id}
                    type="button"
                    onClick={() =>
                      onChange({
                        ...settings,
                        marginsMm: { ...mp.margins, linked: mp.margins.top === mp.margins.left },
                      })
                    }
                    className="px-2 py-0.5 rounded-md text-[11px] border border-[var(--letra-border)] text-[var(--letra-muted)] hover:text-[var(--letra-fg)] hover:bg-[var(--letra-hover)] cursor-pointer"
                  >
                    {mp.id.charAt(0).toUpperCase() + mp.id.slice(1)}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
                  <div key={side}>
                    <label className="block text-[10px] uppercase tracking-wider text-[var(--letra-muted)] mb-1">
                      {side}
                    </label>
                    <input
                      type="number"
                      step={unit === 'in' ? '0.05' : '1'}
                      min="0"
                      max={unit === 'in' ? '3' : '80'}
                      value={mmToUnit(settings.marginsMm[side], unit)}
                      onChange={(e) => updateMargin(side, e.target.value)}
                      className="w-full px-2 py-1 text-xs rounded-md border border-[var(--letra-border)] bg-[var(--letra-input-bg)] text-[var(--letra-fg)] focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {tab === 'header-footer' && (
          <div className="space-y-4">
            {/* Header toggle + slots */}
            <div className="space-y-2">
              <label className="flex items-center justify-between text-xs font-medium cursor-pointer">
                <span>Show Running Header</span>
                <input
                  type="checkbox"
                  checked={settings.showHeader}
                  onChange={(e) => onChange({ ...settings, showHeader: e.target.checked })}
                  className="accent-indigo-500 w-3.5 h-3.5"
                />
              </label>
              {settings.showHeader && (
                <div className="grid grid-cols-3 gap-1.5">
                  {(['left', 'center', 'right'] as const).map((slot) => (
                    <input
                      key={slot}
                      type="text"
                      placeholder={slot}
                      value={settings.header[slot]}
                      onFocus={() => setFocusedSlot({ section: 'header', slot })}
                      onChange={(e) =>
                        onChange({
                          ...settings,
                          header: { ...settings.header, [slot]: e.target.value },
                        })
                      }
                      className="px-2 py-1.5 text-xs rounded-md border border-[var(--letra-border)] bg-[var(--letra-input-bg)] text-[var(--letra-fg)] placeholder:text-[var(--letra-muted)]/60 focus:outline-none focus:border-indigo-500"
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Footer toggle + slots */}
            <div className="space-y-2 pt-2 border-t border-[var(--letra-border)]">
              <label className="flex items-center justify-between text-xs font-medium cursor-pointer">
                <span>Show Running Footer & Page Numbers</span>
                <input
                  type="checkbox"
                  checked={settings.showFooter}
                  onChange={(e) => onChange({ ...settings, showFooter: e.target.checked })}
                  className="accent-indigo-500 w-3.5 h-3.5"
                />
              </label>
              {settings.showFooter && (
                <div className="grid grid-cols-3 gap-1.5">
                  {(['left', 'center', 'right'] as const).map((slot) => (
                    <input
                      key={slot}
                      type="text"
                      placeholder={slot}
                      value={settings.footer[slot]}
                      onFocus={() => setFocusedSlot({ section: 'footer', slot })}
                      onChange={(e) =>
                        onChange({
                          ...settings,
                          footer: { ...settings.footer, [slot]: e.target.value },
                        })
                      }
                      className="px-2 py-1.5 text-xs rounded-md border border-[var(--letra-border)] bg-[var(--letra-input-bg)] text-[var(--letra-fg)] placeholder:text-[var(--letra-muted)]/60 focus:outline-none focus:border-indigo-500"
                    />
                  ))}
                </div>
              )}
            </div>

            <label className="flex items-center justify-between text-xs text-[var(--letra-muted)] cursor-pointer pt-1">
              <span>Hide header & footer on first page</span>
              <input
                type="checkbox"
                checked={settings.differentFirstPage}
                onChange={(e) => onChange({ ...settings, differentFirstPage: e.target.checked })}
                className="accent-indigo-500 w-3.5 h-3.5"
              />
            </label>

            {/* Quick token pills */}
            <div className="pt-2 border-t border-[var(--letra-border)] space-y-1.5">
              <div className="text-[11px] text-[var(--letra-muted)]">
                Click a token to insert into active slot:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {TOKENS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => insertToken(t)}
                    className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 cursor-pointer"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'typography' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <span className="text-xs font-medium">Document Typeface</span>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    ['editorial', 'Editorial', 'Serif + Sans'],
                    ['sans', 'Modern', 'Clean Sans'],
                    ['serif', 'Classic', 'Book Serif'],
                  ] as Array<[TypographyStyle, string, string]>
                ).map(([id, title, desc]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onChange({ ...settings, typography: id })}
                    className={`flex flex-col items-start p-2 rounded-lg border text-left cursor-pointer ${
                      settings.typography === id
                        ? 'border-indigo-500 bg-indigo-500/10'
                        : 'border-[var(--letra-border)] hover:bg-[var(--letra-hover)]'
                    }`}
                  >
                    <span className="text-xs font-medium">{title}</span>
                    <span className="text-[10px] text-[var(--letra-muted)]">{desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">Body Font Size</span>
                <span className="font-mono text-[var(--letra-muted)]">{settings.fontSizePx} px</span>
              </div>
              <input
                type="range"
                min={11}
                max={20}
                step={0.5}
                value={settings.fontSizePx}
                onChange={(e) => onChange({ ...settings, fontSizePx: parseFloat(e.target.value) })}
                className="w-full accent-indigo-500"
              />
            </div>

            {isDarkTheme && (
              <label className="flex items-center justify-between text-xs pt-2 border-t border-[var(--letra-border)] cursor-pointer">
                <div>
                  <div className="font-medium">Print Paper Contrast</div>
                  <div className="text-[11px] text-[var(--letra-muted)]">
                    Display white paper sheets in dark mode
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={forceWhitePaper}
                  onChange={(e) => onToggleForceWhitePaper(e.target.checked)}
                  className="accent-indigo-500 w-3.5 h-3.5"
                />
              </label>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
