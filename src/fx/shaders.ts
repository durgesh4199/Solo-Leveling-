/** GLSL sources for the shader FX layer. Three small programs cover every
 *  battle effect: a "streak" (slash trails), a parametrized "radial" (rings,
 *  the Arise portal swirl, level-up ray bursts), and additive GPU particles
 *  (sparks/embers for impacts and the enemy dissolve). */

const COMMON_VERT_HEADER = `#version 300 es
precision highp float;
in vec2 aCorner; // unit quad corner, [-1, 1]
uniform vec2 uResolution;
uniform vec2 uCenter;   // px, canvas space (origin top-left)
uniform vec2 uSize;     // px, half-extent of the effect's local box
uniform float uAngle;   // radians
out vec2 vUv;

vec2 toClip(vec2 px) {
  vec2 zeroToOne = px / uResolution;
  vec2 clip = zeroToOne * 2.0 - 1.0;
  return vec2(clip.x, -clip.y);
}
`;

export const STREAK_VERT = `${COMMON_VERT_HEADER}
void main() {
  vUv = aCorner;
  float c = cos(uAngle);
  float s = sin(uAngle);
  vec2 local = vec2(aCorner.x * uSize.x, aCorner.y * uSize.y);
  vec2 rotated = vec2(local.x * c - local.y * s, local.x * s + local.y * c);
  gl_Position = vec4(toClip(uCenter + rotated), 0.0, 1.0);
}
`;

export const STREAK_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform vec3 uColor;
uniform float uProgress; // 0..1 over the streak's lifetime

void main() {
  float head = mix(-1.3, 1.3, uProgress);
  float behind = max(head - vUv.x, 0.0);
  float ahead = max(vUv.x - head, 0.0);
  float trail = exp(-behind * 5.5) * (1.0 - step(0.02, ahead));
  float widthFalloff = exp(-vUv.y * vUv.y * 5.0);
  float envelope = smoothstep(0.0, 0.08, uProgress) * (1.0 - smoothstep(0.75, 1.0, uProgress));
  float a = trail * widthFalloff * envelope;
  fragColor = vec4(uColor * a, a);
}
`;

export const RADIAL_VERT = STREAK_VERT;

export const RADIAL_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform vec3 uColor;
uniform float uProgress;
uniform float uTime;
uniform int uMode; // 0 = ring, 1 = swirl (portal), 2 = radiating rays

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main() {
  float r = length(vUv);
  float angle = atan(vUv.y, vUv.x);
  float a = 0.0;
  vec3 col = uColor;

  if (uMode == 0) {
    float radius = mix(0.15, 1.0, uProgress);
    float band = 1.0 - smoothstep(0.0, 0.1, abs(r - radius));
    float fade = 1.0 - smoothstep(0.5, 1.0, uProgress);
    a = band * fade * smoothstep(1.0, 0.7, r);
  } else if (uMode == 1) {
    float mask = 1.0 - smoothstep(0.55, 1.0, r);
    float swirl = angle + (1.0 - r) * 5.0 + uTime * 2.2;
    float n = noise(vec2(cos(swirl), sin(swirl)) * 3.0 + r * 4.0 - uTime * 1.4);
    float stripe = sin(r * 9.0 - uTime * 5.0 + n * 3.0) * 0.5 + 0.5;
    float pull = 1.0 - smoothstep(0.0, 0.5, r);
    float envelope = smoothstep(0.0, 0.2, uProgress) * (1.0 - smoothstep(0.7, 1.0, uProgress));
    a = (stripe * 0.7 + pull * 0.6) * mask * envelope;
    col = mix(uColor, vec3(1.0), n * 0.35);
  } else {
    float rays = pow(abs(cos(angle * 6.0 + uTime * 0.6)), 10.0);
    float mask = smoothstep(1.0, 0.15, r);
    float ring = 1.0 - smoothstep(0.0, 0.12, abs(r - mix(0.1, 0.9, uProgress)));
    float envelope = 1.0 - smoothstep(0.4, 1.0, uProgress);
    a = (rays * mask * 0.8 + ring * 0.6) * envelope;
  }

  fragColor = vec4(col * a, a);
}
`;

export const PARTICLE_VERT = `#version 300 es
precision highp float;
in vec2 aPos;   // px, canvas space
in vec4 aData;  // r, g, b, life (0..1, 1 = fresh)
uniform vec2 uResolution;
uniform float uDpr;
out vec3 vColor;
out float vLife;

void main() {
  vec2 zeroToOne = aPos / uResolution;
  vec2 clip = zeroToOne * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  gl_PointSize = max(1.0, (2.0 + aData.w * 7.0) * uDpr);
  vColor = aData.rgb;
  vLife = aData.w;
}
`;

export const PARTICLE_FRAG = `#version 300 es
precision highp float;
in vec3 vColor;
in float vLife;
out vec4 fragColor;

void main() {
  vec2 d = gl_PointCoord - vec2(0.5);
  float dist = length(d);
  float a = smoothstep(0.5, 0.0, dist) * vLife;
  fragColor = vec4(vColor * a, a);
}
`;
