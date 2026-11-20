/**
 * Pure Canvas Particle & Confetti celebration engine (Zero dependencies)
 * Creates vivid explosions of stars, ribbons, and sparkles for kid rewards.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  vRot: number;
  shape: 'rect' | 'circle' | 'star';
  alpha: number;
}

const COLORS = ['#0284C7', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#38BDF8'];

export function triggerCelebration(durationMs = 2400): void {
  if (typeof window === 'undefined') return;

  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '999999';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return;
  }

  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resize();

  const particles: Particle[] = [];
  const particleCount = 110;

  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 9;
    particles.push({
      x: canvas.width / 2 + (Math.random() - 0.5) * 200,
      y: canvas.height * 0.45,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      size: 6 + Math.random() * 8,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 12,
      shape: Math.random() > 0.4 ? 'rect' : Math.random() > 0.5 ? 'circle' : 'star',
      alpha: 1,
    });
  }

  const startTime = performance.now();

  function draw() {
    if (!ctx) return;
    const elapsed = performance.now() - startTime;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.22; // gravity
      p.vx *= 0.985;
      p.rotation += p.vRot;
      p.alpha = Math.max(0, 1 - elapsed / durationMs);

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;

      if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      } else if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Draw 5-point star
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          ctx.lineTo(Math.cos(((18 + i * 72) * Math.PI) / 180) * p.size, -Math.sin(((18 + i * 72) * Math.PI) / 180) * p.size);
          ctx.lineTo(Math.cos(((54 + i * 72) * Math.PI) / 180) * (p.size / 2), -Math.sin(((54 + i * 72) * Math.PI) / 180) * (p.size / 2));
        }
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    }

    if (elapsed < durationMs) {
      requestAnimationFrame(draw);
    } else {
      canvas.remove();
    }
  }

  requestAnimationFrame(draw);
}
