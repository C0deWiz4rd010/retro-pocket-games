import type { GameMeta } from '@core/Registry';
import { emojiSrc } from '@utils/glyph';

/** Load an image URL into an HTMLImageElement (for drawing emoji art onto the canvas). */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Read a CSS custom property from :root (so the card matches the active theme). */
function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/**
 * Render a themed score-card to an offscreen canvas and share it via the Web Share API,
 * falling back to a PNG download. Entirely client-side (no upload). See docs/06 §5.
 */
export async function shareScoreCard(meta: GameMeta, score: number, isBest: boolean): Promise<void> {
  const W = 1080;
  const H = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const bg = cssVar('--bg', '#0a0a12');
  const surface = cssVar('--surface', '#14141f');
  const primary = cssVar('--primary', '#00f7ff');
  const accent = cssVar('--accent', '#ff2e97');
  const text = cssVar('--text', '#e6e6f0');
  const muted = cssVar('--text-muted', '#8a8aa3');

  // background + neon frame
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, accent + '33');
  grad.addColorStop(1, surface);
  ctx.fillStyle = grad;
  roundRect(ctx, 60, 60, W - 120, H - 120, 40);
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = primary;
  ctx.shadowColor = primary;
  ctx.shadowBlur = 40;
  roundRect(ctx, 60, 60, W - 120, H - 120, 40);
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.textAlign = 'center';

  // brand
  ctx.fillStyle = primary;
  ctx.font = '700 44px Inter, system-ui, sans-serif';
  ctx.fillText('● RETRO POCKET', W / 2, 200);

  // game glyph + title — draw the OpenMoji SVG when available, else fall back to text
  const glyphUrl = emojiSrc(meta.glyph);
  let drewGlyphImg = false;
  if (glyphUrl) {
    try {
      const img = await loadImage(glyphUrl);
      const gs = 200;
      ctx.drawImage(img, (W - gs) / 2, 300, gs, gs);
      drewGlyphImg = true;
    } catch {
      /* fall back to text glyph below */
    }
  }
  if (!drewGlyphImg) {
    ctx.font = '180px serif';
    ctx.fillText(meta.glyph, W / 2, 470);
  }
  ctx.fillStyle = text;
  ctx.font = '800 84px Inter, system-ui, sans-serif';
  ctx.fillText(meta.title.toUpperCase(), W / 2, 600);

  // score
  ctx.fillStyle = muted;
  ctx.font = '600 40px Inter, system-ui, sans-serif';
  ctx.fillText(isBest ? 'NEW PERSONAL BEST' : 'SCORE', W / 2, 720);
  ctx.fillStyle = isBest ? accent : primary;
  ctx.font = '900 200px Inter, system-ui, sans-serif';
  ctx.fillText(score.toLocaleString(), W / 2, 920);

  ctx.fillStyle = muted;
  ctx.font = '500 34px Inter, system-ui, sans-serif';
  ctx.fillText('play it at the link below', W / 2, 1010);

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) return;
  const file = new File([blob], `retro-pocket-${meta.id}.png`, { type: 'image/png' });

  const shareData: ShareData = {
    title: 'Retro Pocket',
    text: `I scored ${score.toLocaleString()} in ${meta.title} on Retro Pocket!`,
    url: location.origin + location.pathname,
  };
  // Prefer native share with the image where supported.
  const navAny = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (navigator.share && navAny.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ ...shareData, files: [file] });
      return;
    } catch {
      /* user cancelled — fall through to download */
    }
  }
  // Fallback: download the PNG.
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
