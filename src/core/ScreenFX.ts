import { Filter, GlProgram } from 'pixi.js';
import { pixi } from './PixiManager';
import { settings } from '@store/settings';

/**
 * Optional CRT post-processing applied to the whole Pixi stage when ScreenFX = "full".
 * Adds scanlines, slight barrel curvature, vignette and chromatic aberration on top of the
 * always-available CSS layer. Kept cheap; auto-downgraded by the FPS monitor under load.
 * See docs/01 §5.
 */

const vertex = `
in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
vec4 filterVertexPosition( void ) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0*uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}
vec2 filterTextureCoord( void ) {
  return aPosition * (uOutputFrame.zw * uInputSize.zw);
}
void main(void) {
  gl_Position = filterVertexPosition();
  vTextureCoord = filterTextureCoord();
}
`;

const fragment = `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec4 uInputSize;
uniform float uIntensity;
uniform float uTime;

void main(void) {
  vec2 uv = vTextureCoord;
  // barrel distortion around the centre
  vec2 cc = uv - 0.5;
  float dist = dot(cc, cc);
  vec2 warped = uv + cc * dist * 0.12 * uIntensity;

  if (warped.x < 0.0 || warped.x > 1.0 || warped.y < 0.0 || warped.y > 1.0) {
    finalColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // chromatic aberration
  float ca = 0.0015 * uIntensity;
  float r = texture(uTexture, warped + vec2(ca, 0.0)).r;
  float g = texture(uTexture, warped).g;
  float b = texture(uTexture, warped - vec2(ca, 0.0)).b;
  vec3 col = vec3(r, g, b);

  // scanlines (tied to the real pixel height of the input)
  float scan = sin(warped.y * uInputSize.y * 1.4) * 0.5 + 0.5;
  col *= 1.0 - 0.18 * uIntensity * scan;

  // vignette
  float vig = smoothstep(0.8, 0.2, dist * 1.4);
  col *= mix(1.0, vig, 0.5 * uIntensity);

  finalColor = vec4(col, 1.0);
}
`;

class ScreenFX {
  private filter: Filter | null = null;
  private active = false;
  private time = 0;

  private build(): Filter {
    if (this.filter) return this.filter;
    this.filter = new Filter({
      glProgram: GlProgram.from({ vertex, fragment }),
      resources: {
        crtUniforms: {
          uIntensity: { value: 0.6, type: 'f32' },
          uTime: { value: 0, type: 'f32' },
        },
      },
    });
    return this.filter;
  }

  /** Reconcile the stage filter with the current ScreenFX setting. Fails safe to CSS. */
  apply(): void {
    const s = settings();
    const wantShader = s.screenFx.mode === 'full';
    try {
      if (wantShader && !this.active) {
        const f = this.build();
        this.setIntensity(s.screenFx.intensity);
        pixi.app.stage.filters = [f];
        this.active = true;
      } else if (!wantShader && this.active) {
        pixi.app.stage.filters = [];
        this.active = false;
      } else if (wantShader && this.active) {
        this.setIntensity(s.screenFx.intensity);
      }
    } catch (err) {
      console.warn('[ScreenFX] shader unavailable, using CSS layer', err);
      this.active = false;
      try {
        pixi.app.stage.filters = [];
      } catch {
        /* ignore */
      }
    }
  }

  /** Drop from the shader to the CSS-only layer (used by the FPS auto-downgrade). */
  downgrade(): void {
    if (!this.active) return;
    pixi.app.stage.filters = [];
    this.active = false;
    document.documentElement.dataset.fx = 'css';
  }

  isActive(): boolean {
    return this.active;
  }

  tick(dt: number): void {
    if (!this.active || !this.filter) return;
    this.time += dt;
    const res = this.filter.resources.crtUniforms.uniforms as { uTime: number };
    res.uTime = this.time;
  }

  private setIntensity(v: number): void {
    if (!this.filter) return;
    const res = this.filter.resources.crtUniforms.uniforms as { uIntensity: number };
    res.uIntensity = v;
  }
}

export const screenFX = new ScreenFX();
