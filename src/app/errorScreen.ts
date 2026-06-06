/**
 * Last-resort error screen. Dependency-free (no i18n/store imports) so it can render even if
 * boot failed before those loaded. Shown by the global handlers in main.ts.
 */
export function showErrorScreen(detail: string): void {
  // Don't stack multiple error screens.
  if (document.querySelector('.fatal')) return;

  const root = document.getElementById('app') ?? document.body;
  const isDe = (navigator.language || 'en').toLowerCase().startsWith('de');
  const title = isDe ? 'Hoppla — etwas ist schiefgelaufen' : 'Oops — something went wrong';
  const hint = isDe
    ? 'Lade die App neu. Bleibt das Problem, setze die Daten in den Einstellungen zurück.'
    : 'Try reloading. If it persists, reset your data in Settings.';
  const reloadLabel = isDe ? 'Neu laden' : 'Reload';

  const wrap = document.createElement('div');
  wrap.className = 'fatal';
  wrap.innerHTML = `
    <div class="fatal__box" role="alert">
      <div class="fatal__icon">⚠</div>
      <div class="fatal__title"></div>
      <div class="fatal__hint"></div>
      <button class="btn btn--primary fatal__reload"></button>
      <details class="fatal__details"><summary>Details</summary><pre></pre></details>
    </div>`;
  wrap.querySelector('.fatal__title')!.textContent = title;
  wrap.querySelector('.fatal__hint')!.textContent = hint;
  const btn = wrap.querySelector<HTMLButtonElement>('.fatal__reload')!;
  btn.textContent = reloadLabel;
  btn.addEventListener('click', () => location.reload());
  wrap.querySelector('pre')!.textContent = detail.slice(0, 500);

  root.replaceChildren(wrap);
}
