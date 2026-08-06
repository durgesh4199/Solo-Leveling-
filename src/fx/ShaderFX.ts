import { compileShader, createUnitQuad, linkProgram } from "./gl";
import { PARTICLE_FRAG, PARTICLE_VERT, RADIAL_FRAG, RADIAL_VERT, STREAK_FRAG, STREAK_VERT } from "./shaders";

void compileShader; // re-exported indirectly via linkProgram; keeps the import used if trimmed later

type RGB = [number, number, number];

interface StreakEffect {
  kind: "streak";
  start: number;
  duration: number;
  x: number; y: number;
  size: [number, number];
  angle: number;
  color: RGB;
}

interface RadialEffect {
  kind: "radial";
  start: number;
  duration: number;
  x: number; y: number;
  size: [number, number];
  mode: 0 | 1 | 2;
  color: RGB;
}

type ActiveEffect = StreakEffect | RadialEffect;

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; decay: number;
  color: RGB;
}

const MAX_PARTICLES = 400;

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * A tiny WebGL2 effects layer that draws on top of the DOM battle UI:
 * energy slash streaks, ring/swirl/ray "radial" bursts (guard, Arise
 * portal, level-up), and an additive GPU particle system for sparks and
 * the enemy dissolve. One shared canvas per battle arena.
 */
export class ShaderFX {
  private gl: WebGL2RenderingContext | null;
  private canvas: HTMLCanvasElement;
  private streakProgram: WebGLProgram | null = null;
  private radialProgram: WebGLProgram | null = null;
  private particleProgram: WebGLProgram | null = null;
  private quad: WebGLBuffer | null = null;
  private particleBuf: WebGLBuffer | null = null;
  private effects: ActiveEffect[] = [];
  private particles: Particle[] = [];
  private raf = 0;
  private dpr = Math.min(window.devicePixelRatio || 1, 2);
  private ro: ResizeObserver | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: true }) as WebGL2RenderingContext | null;
    if (!this.gl) {
      console.warn("Hunter Protocol: WebGL2 unavailable, shader FX disabled. Falling back to CSS-only effects.");
      return;
    }
    try {
      this.init();
    } catch (err) {
      console.warn("Hunter Protocol: shader FX failed to initialize, disabling.", err);
      this.gl = null;
    }
  }

  get enabled(): boolean {
    return !!this.gl;
  }

  private init() {
    const gl = this.gl!;
    this.streakProgram = linkProgram(gl, STREAK_VERT, STREAK_FRAG);
    this.radialProgram = linkProgram(gl, RADIAL_VERT, RADIAL_FRAG);
    this.particleProgram = linkProgram(gl, PARTICLE_VERT, PARTICLE_FRAG);
    this.quad = createUnitQuad(gl);
    this.particleBuf = gl.createBuffer();

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.canvas);
    this.resize();

    this.raf = requestAnimationFrame(this.tick);
  }

  resize() {
    if (!this.gl) return;
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width * this.dpr));
    const h = Math.max(1, Math.round(rect.height * this.dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, w, h);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
  }

  // ---- public triggers (x/y in CSS px, relative to the canvas) ----
  // All no-op safely if WebGL2 isn't available - the CSS effects still play.

  slash(x: number, y: number, color: string, angleDeg: number) {
    if (!this.enabled) return;
    this.pushStreak(x, y, color, angleDeg, 60);
    this.spawnBurst(x, y, hexToRgb(color), 10, 60, 0.5);
  }

  flurry(x: number, y: number, color: string, angleDeg: number) {
    if (!this.enabled) return;
    this.pushStreak(x, y, color, angleDeg - 12, 58, 0);
    this.pushStreak(x, y, color, angleDeg + 10, 58, 70);
    this.pushStreak(x, y, color, angleDeg, 58, 140);
    this.pushRadial(x, y, color, 0, 46, 500, 150);
    this.spawnBurst(x, y, hexToRgb(color), 22, 90, 0.7);
  }

  guardRing(x: number, y: number, color: string) {
    if (!this.enabled) return;
    this.pushRadial(x, y, color, 0, 50, 650);
  }

  /** A telegraphed enemy special landing - one big ray-burst shockwave
   *  plus a heavier outward particle spray, distinct from both the
   *  player's own slash and crit-flurry so a special reads as its own
   *  kind of threat instead of just "a harder version of a normal hit". */
  smash(x: number, y: number, color: string) {
    if (!this.enabled) return;
    this.pushRadial(x, y, color, 2, 95, 520);
    this.spawnBurst(x, y, hexToRgb(color), 36, 130, 0.8, true);
  }

  impactSparks(x: number, y: number, color: string) {
    if (!this.enabled) return;
    this.spawnBurst(x, y, hexToRgb(color), 14, 70, 0.55);
  }

  /** `scale` shrinks the swirl+burst for small group-member portraits
   *  (76px) so it doesn't blow past its own slot into its neighbors' -
   *  full size (1) suits the 132px player/boss portraits. */
  dissolve(x: number, y: number, color: string, scale = 1) {
    if (!this.enabled) return;
    this.pushRadial(x, y, color, 1, 80 * scale, 1000);
    this.spawnBurst(x, y, hexToRgb(color), Math.round(60 * scale), 130 * scale, 1.1, true);
  }

  arisePortal(x: number, y: number, color: string, scale = 1) {
    if (!this.enabled) return;
    this.pushRadial(x, y, color, 1, 90 * scale, 1300);
    this.spawnBurst(x, y, hexToRgb(color), Math.round(50 * scale), 110 * scale, 1.2, true, true);
  }

  levelUpBurst(x: number, y: number, color: string) {
    if (!this.enabled) return;
    this.pushRadial(x, y, color, 2, 100, 900);
    this.spawnBurst(x, y, hexToRgb(color), 40, 140, 1.0);
  }

  // ---- internals ----

  private pushStreak(x: number, y: number, color: string, angleDeg: number, size: number, delay = 0) {
    const start = performance.now() + delay;
    this.effects.push({
      kind: "streak", start, duration: 340,
      x, y, size: [size, size * 0.16], angle: (angleDeg * Math.PI) / 180,
      color: hexToRgb(color)
    });
  }

  private pushRadial(x: number, y: number, color: string, mode: 0 | 1 | 2, size: number, duration: number, delay = 0) {
    const start = performance.now() + delay;
    this.effects.push({ kind: "radial", start, duration, x, y, size: [size, size], mode, color: hexToRgb(color) });
  }

  private spawnBurst(x: number, y: number, color: RGB, count: number, speed: number, lifeSec: number, outward = false, inward = false) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.9);
      const vx = Math.cos(a) * s;
      const vy = Math.sin(a) * s;
      this.particles.push({
        x: x + (outward || inward ? Math.cos(a) * (inward ? 40 : 4) : 0),
        y: y + (outward || inward ? Math.sin(a) * (inward ? 40 : 4) : 0),
        vx: inward ? -vx * 0.6 : vx,
        vy: inward ? -vy * 0.6 : vy - (outward ? 20 : 0),
        life: 1,
        decay: 1 / (lifeSec * (0.7 + Math.random() * 0.6)),
        color
      });
    }
  }

  private lastTick = performance.now();

  private tick = (now: number) => {
    const dt = Math.min(0.05, (now - this.lastTick) / 1000);
    this.lastTick = now;
    this.updateParticles(dt);
    this.render(now);
    this.raf = requestAnimationFrame(this.tick);
  };

  private updateParticles(dt: number) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 40 * dt; // gentle gravity for a bit of arc
      p.life -= p.decay * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  private render(now: number) {
    const gl = this.gl;
    if (!gl) return;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    const resW = this.canvas.width;
    const resH = this.canvas.height;

    this.effects = this.effects.filter((e) => now < e.start + e.duration);

    for (const e of this.effects) {
      if (now < e.start) continue;
      const progress = Math.min(1, (now - e.start) / e.duration);
      if (e.kind === "streak") this.drawStreak(e, progress, resW, resH);
      else this.drawRadial(e, progress, now, resW, resH);
    }

    this.drawParticles(resW, resH);
  }

  private drawStreak(e: StreakEffect, progress: number, resW: number, resH: number) {
    const gl = this.gl!;
    gl.useProgram(this.streakProgram);
    this.bindQuad(this.streakProgram!);
    gl.uniform2f(gl.getUniformLocation(this.streakProgram!, "uResolution"), resW, resH);
    gl.uniform2f(gl.getUniformLocation(this.streakProgram!, "uCenter"), e.x * this.dpr, e.y * this.dpr);
    gl.uniform2f(gl.getUniformLocation(this.streakProgram!, "uSize"), e.size[0] * this.dpr, e.size[1] * this.dpr);
    gl.uniform1f(gl.getUniformLocation(this.streakProgram!, "uAngle"), e.angle);
    gl.uniform3f(gl.getUniformLocation(this.streakProgram!, "uColor"), ...e.color);
    gl.uniform1f(gl.getUniformLocation(this.streakProgram!, "uProgress"), progress);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private drawRadial(e: RadialEffect, progress: number, now: number, resW: number, resH: number) {
    const gl = this.gl!;
    gl.useProgram(this.radialProgram);
    this.bindQuad(this.radialProgram!);
    gl.uniform2f(gl.getUniformLocation(this.radialProgram!, "uResolution"), resW, resH);
    gl.uniform2f(gl.getUniformLocation(this.radialProgram!, "uCenter"), e.x * this.dpr, e.y * this.dpr);
    gl.uniform2f(gl.getUniformLocation(this.radialProgram!, "uSize"), e.size[0] * this.dpr, e.size[1] * this.dpr);
    gl.uniform1f(gl.getUniformLocation(this.radialProgram!, "uAngle"), 0);
    gl.uniform3f(gl.getUniformLocation(this.radialProgram!, "uColor"), ...e.color);
    gl.uniform1f(gl.getUniformLocation(this.radialProgram!, "uProgress"), progress);
    gl.uniform1f(gl.getUniformLocation(this.radialProgram!, "uTime"), now / 1000);
    gl.uniform1i(gl.getUniformLocation(this.radialProgram!, "uMode"), e.mode);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private bindQuad(program: WebGLProgram) {
    const gl = this.gl!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    const loc = gl.getAttribLocation(program, "aCorner");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  }

  private drawParticles(resW: number, resH: number) {
    const gl = this.gl!;
    if (this.particles.length === 0) return;
    gl.useProgram(this.particleProgram);

    const posData = new Float32Array(this.particles.length * 2);
    const colData = new Float32Array(this.particles.length * 4);
    this.particles.forEach((p, i) => {
      posData[i * 2] = p.x * this.dpr;
      posData[i * 2 + 1] = p.y * this.dpr;
      colData[i * 4] = p.color[0];
      colData[i * 4 + 1] = p.color[1];
      colData[i * 4 + 2] = p.color[2];
      colData[i * 4 + 3] = Math.max(0, p.life);
    });

    gl.bindBuffer(gl.ARRAY_BUFFER, this.particleBuf);
    const interleaved = new Float32Array(this.particles.length * 6);
    for (let i = 0; i < this.particles.length; i++) {
      interleaved[i * 6] = posData[i * 2];
      interleaved[i * 6 + 1] = posData[i * 2 + 1];
      interleaved[i * 6 + 2] = colData[i * 4];
      interleaved[i * 6 + 3] = colData[i * 4 + 1];
      interleaved[i * 6 + 4] = colData[i * 4 + 2];
      interleaved[i * 6 + 5] = colData[i * 4 + 3];
    }
    gl.bufferData(gl.ARRAY_BUFFER, interleaved, gl.DYNAMIC_DRAW);

    const stride = 6 * 4;
    const posLoc = gl.getAttribLocation(this.particleProgram!, "aPos");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, stride, 0);
    const dataLoc = gl.getAttribLocation(this.particleProgram!, "aData");
    gl.enableVertexAttribArray(dataLoc);
    gl.vertexAttribPointer(dataLoc, 4, gl.FLOAT, false, stride, 2 * 4);

    gl.uniform2f(gl.getUniformLocation(this.particleProgram!, "uResolution"), resW, resH);
    gl.uniform1f(gl.getUniformLocation(this.particleProgram!, "uDpr"), this.dpr);
    gl.drawArrays(gl.POINTS, 0, this.particles.length);
  }
}
