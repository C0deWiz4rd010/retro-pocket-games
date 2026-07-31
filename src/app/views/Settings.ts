import { el } from '@utils/dom';
import { settings, updateSettings } from '@store/settings';
import { audio } from '@core/AudioManager';
import { haptics } from '@core/Haptics';
import { exportAll, importAll, wipeAll } from '@data/db';
import type { Action } from '@core/InputManager';
import { t } from '@i18n/index';
import type { Settings } from '@data/schemas';

type Opt<T> = { value: T; label: string };

/** Build the Settings screen. Re-renders its rows in place when a value changes. */
export function renderSettings(): HTMLElement {
  const container = el('div', { class: 'scroll' });

  const rerender = (): void => container.replaceChildren(...rows(rerender));
  rerender();
  return container;
}

function rows(rerender: () => void): HTMLElement[] {
  const s = settings();

  const seg = <T extends string>(
    current: T,
    opts: Opt<T>[],
    onPick: (v: T) => void,
  ): HTMLElement =>
    el(
      'div',
      { class: 'seg' },
      opts.map((o) =>
        el(
          'button',
          {
            class: o.value === current ? 'on' : '',
            onClick: () => {
              audio.sfx('blip');
              onPick(o.value);
              rerender();
            },
          },
          [o.label],
        ),
      ),
    );

  const toggle = (on: boolean, onToggle: (v: boolean) => void): HTMLElement =>
    el('button', {
      class: `switch${on ? ' on' : ''}`,
      role: 'switch',
      'aria-checked': String(on),
      onClick: () => {
        onToggle(!on);
        rerender();
      },
    });

  const row = (label: string, control: Node): HTMLElement =>
    el('div', { class: 'setting' }, [el('span', {}, [label]), control as HTMLElement]);

  const slider = (value: number, onChange: (v: number) => void): HTMLElement =>
    el('input', {
      class: 'slider',
      type: 'range',
      min: '0',
      max: '100',
      value: String(Math.round(value * 100)),
      onInput: (e: Event) => onChange(Number((e.target as HTMLInputElement).value) / 100),
    });

  const patchScreenFx = (p: Partial<Settings['screenFx']>) =>
    updateSettings({ screenFx: { ...s.screenFx, ...p } });
  const patchAudio = (p: Partial<Settings['audio']>) => updateSettings({ audio: { ...s.audio, ...p } });
  const patchA11y = (p: Partial<Settings['a11y']>) => updateSettings({ a11y: { ...s.a11y, ...p } });
  const patchControls = (p: Partial<Settings['controls']>) =>
    updateSettings({ controls: { ...s.controls, ...p } });

  // Theme swatch preview — clickable color chips for an at-a-glance pick.
  const THEME_COLORS: Record<string, string[]> = {
    cyberpunk: ['#0a0a12', '#00f7ff', '#ff2e97'],
    gameboy: ['#0f380f', '#9bbc0f', '#8bac0f'],
    c64: ['#3e31a2', '#a8a0ff', '#7c70da'],
    amber: ['#1a1308', '#ffb000', '#ff7b00'],
  };
  const swatches = el(
    'div',
    { class: 'theme-swatches' },
    (['cyberpunk', 'gameboy', 'c64', 'amber'] as const).map((th) =>
      el('button', {
        class: `theme-swatch${s.theme === th ? ' on' : ''}`,
        'aria-label': th,
        onClick: () => {
          audio.sfx('blip');
          updateSettings({ theme: th });
          rerender();
        },
      }, THEME_COLORS[th]!.map((c) => el('span', { style: `background:${c}` }))),
    ),
  );

  return [
    el('div', { class: 'section-title' }, [t('settings.appearance')]),
    row(
      t('settings.theme'),
      seg(
        s.theme,
        [
          { value: 'cyberpunk', label: 'Neon' },
          { value: 'gameboy', label: 'GB' },
          { value: 'c64', label: 'C64' },
          { value: 'amber', label: 'Amber' },
        ],
        (theme) => updateSettings({ theme }),
      ),
    ),
    swatches,
    row(
      t('settings.skin'),
      seg(
        s.skin,
        [
          { value: 'console', label: 'Console' },
          { value: 'launcher', label: 'Launcher' },
        ],
        (skin) => updateSettings({ skin }),
      ),
    ),
    ...(s.skin === 'console'
      ? [
          row(
            t('settings.shell'),
            seg(
              s.shell,
              [
                { value: 'brick', label: 'Brick' },
                { value: 'slim', label: 'Slim' },
                { value: 'wide', label: 'Wide' },
                { value: 'tv', label: 'TV' },
              ],
              (shell) => updateSettings({ shell }),
            ),
          ),
        ]
      : []),
    row(
      t('settings.fx'),
      seg(
        s.screenFx.mode,
        [
          { value: 'off', label: 'Off' },
          { value: 'css', label: 'CRT' },
          { value: 'full', label: 'Full' },
        ],
        (mode) => patchScreenFx({ mode }),
      ),
    ),
    row('CRT intensity', slider(s.screenFx.intensity, (intensity) => patchScreenFx({ intensity }))),
    row(
      t('settings.language'),
      seg(
        s.locale,
        [
          { value: 'en', label: 'EN' },
          { value: 'de', label: 'DE' },
        ],
        (locale) => {
          updateSettings({ locale });
          rerender();
        },
      ),
    ),

    el('div', { class: 'section-title' }, [t('settings.audio')]),
    row(t('settings.volume'), slider(s.audio.master, (master) => patchAudio({ master }))),
    row(t('settings.sfx'), toggle(s.audio.sfx, (sfx) => patchAudio({ sfx }))),
    row(t('settings.music'), toggle(s.audio.music, (music) => patchAudio({ music }))),
    row(t('settings.muteOnBlur'), toggle(s.audio.muteOnBlur, (muteOnBlur) => patchAudio({ muteOnBlur }))),

    el('div', { class: 'section-title' }, [t('settings.controls')]),
    row(
      t('settings.haptics'),
      el('div', { style: 'display:flex;gap:8px;align-items:center' }, [
        s.controls.haptics
          ? el('button', {
              class: 'btn btn--ghost',
              style: 'min-height:36px;padding:0 12px',
              onClick: () => haptics.pattern([0, 20, 40, 30]),
            }, [t('settings.test')])
          : '',
        toggle(s.controls.haptics, (h) => patchControls({ haptics: h })),
      ]),
    ),
    row(
      t('settings.hand'),
      seg(
        s.controls.touchLayout,
        [
          { value: 'right', label: 'Right' },
          { value: 'left', label: 'Left' },
        ],
        (touchLayout) => patchControls({ touchLayout }),
      ),
    ),
    row(
      t('settings.touchOpacity'),
      slider((s.controls.touchOpacity - 0.3) / 0.7, (v) =>
        patchControls({ touchOpacity: Math.round((0.3 + v * 0.7) * 100) / 100 }),
      ),
    ),
    row(
      t('settings.touchSize'),
      seg(
        s.controls.touchScale <= 0.9 ? 'sm' : s.controls.touchScale >= 1.15 ? 'lg' : 'md',
        [
          { value: 'sm', label: 'S' },
          { value: 'md', label: 'M' },
          { value: 'lg', label: 'L' },
        ],
        (size) => patchControls({ touchScale: size === 'sm' ? 0.85 : size === 'lg' ? 1.2 : 1 }),
      ),
    ),

    el('div', { class: 'section-title' }, [t('settings.keyBindings')]),
    ...REBINDABLE.map(({ action, label, def }) => {
      const code = s.keyBindings[action] ?? def;
      const btn = el('button', {
        class: 'btn btn--ghost',
        style: 'min-width:74px',
        onClick: () => {
          btn.textContent = `· ${t('settings.pressKey')} ·`;
          const onKey = (e: KeyboardEvent): void => {
            e.preventDefault();
            window.removeEventListener('keydown', onKey, true);
            if (e.code !== 'Escape') {
              updateSettings({ keyBindings: { ...settings().keyBindings, [action]: e.code } });
            }
            rerender();
          };
          window.addEventListener('keydown', onKey, true);
        },
      }, [codeLabel(code)]);
      return row(label, btn);
    }),
    el('div', { class: 'panel__row', style: 'padding:2px 0 6px' }, [
      el('button', {
        class: 'btn btn--ghost btn--block',
        onClick: () => { updateSettings({ keyBindings: {} }); rerender(); },
      }, [t('settings.resetKeys')]),
    ]),

    el('div', { class: 'section-title' }, [t('settings.a11y')]),
    row(t('settings.reducedMotion'), toggle(s.a11y.reducedMotion, (reducedMotion) => patchA11y({ reducedMotion }))),
    row(t('settings.highContrast'), toggle(s.a11y.highContrast, (highContrast) => patchA11y({ highContrast }))),
    row(
      'Colorblind palette',
      seg(
        s.a11y.colorblind,
        [
          { value: 'off', label: 'Off' },
          { value: 'protan', label: 'Protan' },
          { value: 'deutan', label: 'Deutan' },
          { value: 'tritan', label: 'Tritan' },
        ],
        (colorblind) => patchA11y({ colorblind }),
      ),
    ),
    row(t('settings.largeTargets'), toggle(s.a11y.largeTargets, (largeTargets) => patchA11y({ largeTargets }))),

    el('div', { class: 'section-title' }, [t('settings.data')]),
    el('div', { class: 'panel__row', style: 'padding:8px 0 8px' }, [
      el('button', { class: 'btn btn--ghost btn--block', onClick: () => void doExport() }, [`⬇ ${t('settings.export')}`]),
      el('button', { class: 'btn btn--ghost btn--block', onClick: () => doImport() }, [`⬆ ${t('settings.import')}`]),
    ]),
    el('div', { class: 'panel__row', style: 'padding:0 0 20px' }, [
      el('button', {
        class: 'btn btn--danger btn--block',
        onClick: () => confirmReset(),
      }, [`⟲ ${t('settings.reset')}`]),
    ]),
    el('div', { style: 'text-align:center;color:var(--text-muted);font-size:11px;padding-bottom:20px' }, [
      `${t('settings.footer')} · v${import.meta.env.VITE_APP_VERSION ?? '0.0.0'}`,
    ]),
  ];
}

/** Rebindable gameplay actions and their default key codes (shown in the rebinding UI). */
const REBINDABLE: { action: Action; label: string; def: string }[] = [
  { action: 'up', label: '▲ Up', def: 'ArrowUp' },
  { action: 'down', label: '▼ Down', def: 'ArrowDown' },
  { action: 'left', label: '◀ Left', def: 'ArrowLeft' },
  { action: 'right', label: '▶ Right', def: 'ArrowRight' },
  { action: 'a', label: 'A · Action', def: 'Space' },
  { action: 'b', label: 'B · Secondary', def: 'KeyX' },
];

/** Friendly label for a KeyboardEvent.code (e.g. KeyZ → Z, ArrowUp → ↑). */
function codeLabel(code: string): string {
  const arrows: Record<string, string> = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
  if (arrows[code]) return arrows[code]!;
  if (code === 'Space') return 'Space';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

async function doExport(): Promise<void> {
  const data = await exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'retro-pocket-save.json';
  a.click();
  URL.revokeObjectURL(url);
}

/** Restore progress from a previously exported JSON backup, then reload. */
function doImport(): void {
  const input = el('input', { type: 'file', accept: 'application/json', style: 'display:none' }) as HTMLInputElement;
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        void importAll(data).then((n) => {
          audio.sfx('coin');
          window.alert(t('settings.importDone', { n }));
          location.reload();
        }).catch(() => window.alert(t('settings.importFail')));
      } catch {
        window.alert(t('settings.importFail'));
      }
    };
    reader.readAsText(file);
  });
  document.body.append(input);
  input.click();
  window.setTimeout(() => input.remove(), 1000);
}

/** Two-step confirmation overlay so progress can't be wiped by accident. */
function confirmReset(): void {
  const overlay = el('div', { class: 'overlay' });
  overlay.dataset.overlay = '1';
  const panel = el('div', { class: 'panel', role: 'dialog', 'aria-modal': 'true' }, [
    el('div', { class: 'panel__title' }, ['⚠']),
    el('div', { style: 'font-size:15px' }, [t('settings.resetConfirm')]),
    el('button', {
      class: 'btn btn--danger btn--block',
      onClick: () => void wipeAll().then(() => location.reload()),
    }, [t('settings.resetYes')]),
    el('button', { class: 'btn btn--ghost btn--block', onClick: () => overlay.remove() }, [
      t('settings.cancel'),
    ]),
  ]);
  overlay.append(panel);
  (document.querySelector('.screen__view') ?? document.body).append(overlay);
  panel.querySelector<HTMLElement>('.btn--ghost')?.focus(); // default to the safe action
}
