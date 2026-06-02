import { el } from '@utils/dom';
import { settings, updateSettings } from '@store/settings';
import { audio } from '@core/AudioManager';
import { exportAll, wipeAll } from '@data/db';
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

  const patchScreenFx = (p: Partial<Settings['screenFx']>) =>
    updateSettings({ screenFx: { ...s.screenFx, ...p } });
  const patchAudio = (p: Partial<Settings['audio']>) => updateSettings({ audio: { ...s.audio, ...p } });
  const patchA11y = (p: Partial<Settings['a11y']>) => updateSettings({ a11y: { ...s.a11y, ...p } });
  const patchControls = (p: Partial<Settings['controls']>) =>
    updateSettings({ controls: { ...s.controls, ...p } });

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
    row(t('settings.sfx'), toggle(s.audio.sfx, (sfx) => patchAudio({ sfx }))),
    row(t('settings.muteOnBlur'), toggle(s.audio.muteOnBlur, (muteOnBlur) => patchAudio({ muteOnBlur }))),

    el('div', { class: 'section-title' }, [t('settings.controls')]),
    row(t('settings.haptics'), toggle(s.controls.haptics, (haptics) => patchControls({ haptics }))),
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

    el('div', { class: 'section-title' }, [t('settings.a11y')]),
    row(t('settings.reducedMotion'), toggle(s.a11y.reducedMotion, (reducedMotion) => patchA11y({ reducedMotion }))),
    row(t('settings.highContrast'), toggle(s.a11y.highContrast, (highContrast) => patchA11y({ highContrast }))),
    row(t('settings.largeTargets'), toggle(s.a11y.largeTargets, (largeTargets) => patchA11y({ largeTargets }))),

    el('div', { class: 'section-title' }, [t('settings.data')]),
    el('div', { class: 'panel__row', style: 'padding:8px 0 20px' }, [
      el('button', { class: 'btn btn--ghost btn--block', onClick: () => void doExport() }, [`⬇ ${t('settings.export')}`]),
      el('button', {
        class: 'btn btn--danger btn--block',
        onClick: () => void doReset(rerender),
      }, [`⟲ ${t('settings.reset')}`]),
    ]),
    el('div', { style: 'text-align:center;color:var(--text-muted);font-size:11px;padding-bottom:20px' }, [
      t('settings.footer'),
    ]),
  ];
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

async function doReset(rerender: () => void): Promise<void> {
  await wipeAll();
  location.reload();
  rerender();
}
