/**
 * Lightweight confetti burst for celebrating a new personal best. Pure canvas, no deps,
 * self-cleans after ~1.6s, and is a no-op when reduced-motion is active.
 */
export function confettiBurst(host: HTMLElement): void {
  if (document.documentElement.classList.contains('a11y-reduced-motion')) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'confetti-canvas';
  const rect = host.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return;
  }
  ctx.scale(dpr, dpr);

  const themeColor = (name: string, fb: string): string =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb;
  const colors = [
    themeColor('--primary', '#00f7ff'),
    themeColor('--accent', '#ff2e97'),
    themeColor('--ok', '#3ddc84'),
    themeColor('--warn', '#ffb000'),
  ];

  const W = rect.width;
  const N = 90;
  interface P {
    x: number;
    y: number;
    vx: number;
    vy: number;
    rot: number;
    vr: number;
    size: number;
    color: string;
  }
  const parts: P[] = Array.from({ length: N }, () => ({
    x: W / 2 + (Math.random() - 0.5) * 80,
    y: rect.height * 0.35,
    vx: (Math.random() - 0.5) * 420,
    vy: -200 - Math.random() * 320,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 10,
    size: 6 + Math.random() * 6,
    color: colors[Math.floor(Math.random() * colors.length)] ?? '#fff',
  }));

  const G = 900;
  let last = performance.now();
  const start = last;

  const frame = (now: number): void => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    ctx.clearRect(0, 0, W, rect.height);
    for (const p of parts) {
      p.vy += G * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }
    if (now - start < 1600) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
