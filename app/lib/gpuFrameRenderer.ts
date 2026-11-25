/**
 * Single-Pass WebGL2 GPU Shader Frame Renderer
 *
 * Replaces 2D Canvas dual-blit compositing with a single full-screen triangle
 * fragment shader pass:
 *  - Hardware `object-fit: cover` UV mapping in shader
 *  - Single-pass Hermite cross-fade (`mix(texA, texB, blendAlpha)`) — 1x fill-rate
 *  - Integrated vignette gradient (eliminates extra full-screen DOM compositor layer)
 *  - Resident VRAM texture pool; decoded ImageBitmaps are closed immediately after
 *    upload so uncompressed RGBA frames do not sit in JS/system RAM.
 */

const VERT_SRC = `#version 300 es
precision highp float;

out vec2 vScreenUv;

void main() {
  // Full-screen oversized triangle (zero VBOs)
  float x = float((gl_VertexID & 1) << 2) - 1.0;
  float y = float((gl_VertexID & 2) << 1) - 1.0;
  gl_Position = vec4(x, y, 0.0, 1.0);
  // Map clip-space [-1,1] to screen UV with (0,0) top-left and (1,1) bottom-right
  vScreenUv = vec2((x + 1.0) * 0.5, (1.0 - y) * 0.5);
}
`;

const FRAG_SRC = `#version 300 es
precision highp float;

in vec2 vScreenUv;

uniform sampler2D uTexA;
uniform sampler2D uTexB;
uniform vec4 uUvScaleOffset; // xy = scale, zw = offset (object-fit: cover)
uniform float uBlendAlpha;
uniform int uHasB;

out vec4 fragColor;

void main() {
  vec2 uv = vScreenUv * uUvScaleOffset.xy + uUvScaleOffset.zw;
  vec4 col = texture(uTexA, uv);

  if (uHasB == 1 && uBlendAlpha > 0.001) {
    vec4 colB = texture(uTexB, uv);
    col = mix(col, colB, uBlendAlpha);
  }

  // Subtle vignette matching CSS: bg-gradient-to-t from-black/50 via-transparent to-black/20
  float vigAlpha = vScreenUv.y >= 0.5
    ? (vScreenUv.y - 0.5) * 1.0
    : (0.5 - vScreenUv.y) * 0.4;
  col.rgb *= (1.0 - vigAlpha);

  fragColor = vec4(col.rgb, 1.0);
}
`;

export type GpuUploadableAsset = ImageBitmap | HTMLImageElement;

export interface ScrollyRenderer {
  isReady(): boolean;
  hasTexture(key: string): boolean;
  getTextureCount(): number;
  uploadTexture(key: string, asset: GpuUploadableAsset): boolean;
  evictTexture(key: string): void;
  clearTextures(): void;
  render(
    keyA: string,
    keyB: string | null,
    blendAlpha: number,
    targetWidth: number,
    targetHeight: number,
    imgWidth: number,
    imgHeight: number
  ): boolean;
  setPaused?(paused: boolean): void;
  dispose(): void;
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("[GpuFrameRenderer] Shader compile error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext): WebGLProgram | null {
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
  if (!vs || !fs) {
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    return null;
  }

  const prog = gl.createProgram();
  if (!prog) {
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }

  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);

  // Shaders can be deleted immediately after linking
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn("[GpuFrameRenderer] Program link error:", gl.getProgramInfoLog(prog));
    gl.deleteProgram(prog);
    return null;
  }

  return prog;
}

export class GpuFrameRenderer implements ScrollyRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;

  private uTexALoc: WebGLUniformLocation | null = null;
  private uTexBLoc: WebGLUniformLocation | null = null;
  private uUvScaleOffsetLoc: WebGLUniformLocation | null = null;
  private uBlendAlphaLoc: WebGLUniformLocation | null = null;
  private uHasBLoc: WebGLUniformLocation | null = null;

  private textures = new Map<string, { tex: WebGLTexture; w: number; h: number }>();
  private freePool: Array<{ tex: WebGLTexture; w: number; h: number }> = [];
  private contextLost = false;
  private onContextRestoredCb: (() => void) | null = null;

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    this.contextLost = true;
    this.textures.clear();
    this.freePool.length = 0;
  };

  private handleContextRestored = () => {
    this.contextLost = false;
    this.initResources();
    this.onContextRestoredCb?.();
  };

  init(canvas: HTMLCanvasElement, onContextRestored?: () => void): boolean {
    this.canvas = canvas;
    this.onContextRestoredCb = onContextRestored ?? null;

    const isSafari =
      typeof navigator !== "undefined" &&
      /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      // Safari's desynchronized WebGL2 causes severe frame-pacing stutter
      desynchronized: !isSafari,
      powerPreference: "high-performance",
    });

    if (!gl) return false;

    this.gl = gl;
    canvas.addEventListener("webglcontextlost", this.handleContextLost);
    canvas.addEventListener("webglcontextrestored", this.handleContextRestored);

    return this.initResources();
  }

  private initResources(): boolean {
    const gl = this.gl;
    if (!gl || gl.isContextLost()) return false;

    const program = createProgram(gl);
    if (!program) return false;

    const vao = gl.createVertexArray();
    if (!vao) {
      gl.deleteProgram(program);
      return false;
    }

    this.program = program;
    this.vao = vao;

    this.uTexALoc = gl.getUniformLocation(program, "uTexA");
    this.uTexBLoc = gl.getUniformLocation(program, "uTexB");
    this.uUvScaleOffsetLoc = gl.getUniformLocation(program, "uUvScaleOffset");
    this.uBlendAlphaLoc = gl.getUniformLocation(program, "uBlendAlpha");
    this.uHasBLoc = gl.getUniformLocation(program, "uHasB");

    gl.useProgram(program);
    gl.uniform1i(this.uTexALoc, 0);
    gl.uniform1i(this.uTexBLoc, 1);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    return true;
  }

  isReady(): boolean {
    return this.gl !== null && this.program !== null && !this.contextLost;
  }

  hasTexture(key: string): boolean {
    return this.textures.has(key);
  }

  getTextureCount(): number {
    return this.textures.size;
  }

  uploadTexture(key: string, asset: GpuUploadableAsset): boolean {
    const gl = this.gl;
    if (!gl || this.contextLost) return false;

    const existing = this.textures.get(key);
    if (existing) return true;

    const w = "naturalWidth" in asset && asset.naturalWidth ? asset.naturalWidth : asset.width;
    const h = "naturalHeight" in asset && asset.naturalHeight ? asset.naturalHeight : asset.height;
    if (!w || !h) return false;

    // Recycle a pre-allocated texture of the same dimensions via texSubImage2D
    // to eliminate Metal/WebGL texture allocation stalls on Safari during scroll.
    const poolIdx = this.freePool.findIndex((item) => item.w === w && item.h === h);
    if (poolIdx !== -1) {
      const reused = this.freePool.splice(poolIdx, 1)[0];
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, reused.tex);
      try {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, asset);
        this.textures.set(key, reused);
        return true;
      } catch {
        gl.deleteTexture(reused.tex);
      }
    }

    const tex = gl.createTexture();
    if (!tex) return false;

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, asset);
      this.textures.set(key, { tex, w, h });
      return true;
    } catch {
      gl.deleteTexture(tex);
      return false;
    }
  }

  evictTexture(key: string): void {
    const gl = this.gl;
    const entry = this.textures.get(key);
    if (entry) {
      this.textures.delete(key);
      if (gl && !this.contextLost) {
        if (this.freePool.length < 14) {
          this.freePool.push(entry);
        } else {
          gl.deleteTexture(entry.tex);
        }
      }
    }
  }

  clearTextures(): void {
    const gl = this.gl;
    if (gl && !this.contextLost) {
      for (const entry of this.textures.values()) {
        gl.deleteTexture(entry.tex);
      }
      for (const entry of this.freePool) {
        gl.deleteTexture(entry.tex);
      }
    }
    this.textures.clear();
    this.freePool.length = 0;
  }

  render(
    keyA: string,
    keyB: string | null,
    blendAlpha: number,
    targetWidth: number,
    targetHeight: number,
    imgWidth: number,
    imgHeight: number
  ): boolean {
    const gl = this.gl;
    const canvas = this.canvas;
    if (!gl || !canvas || !this.program || !this.vao || this.contextLost) return false;

    const entryA = this.textures.get(keyA);
    if (!entryA) return false;

    const entryB = keyB ? this.textures.get(keyB) ?? null : null;

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    gl.viewport(0, 0, targetWidth, targetHeight);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    // Compute object-fit: cover scale & offset
    const imgRatio = imgWidth / imgHeight;
    const canvasRatio = targetWidth / targetHeight;
    let scaleX = 1.0;
    let scaleY = 1.0;
    let offsetX = 0.0;
    let offsetY = 0.0;

    if (canvasRatio > imgRatio) {
      scaleY = imgRatio / canvasRatio;
      offsetY = (1.0 - scaleY) * 0.5;
    } else {
      scaleX = canvasRatio / imgRatio;
      offsetX = (1.0 - scaleX) * 0.5;
    }

    gl.uniform4f(this.uUvScaleOffsetLoc, scaleX, scaleY, offsetX, offsetY);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, entryA.tex);

    if (entryB && keyB !== keyA && blendAlpha > 0.001) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, entryB.tex);
      gl.uniform1i(this.uHasBLoc, 1);
      gl.uniform1f(this.uBlendAlphaLoc, blendAlpha);
    } else {
      gl.uniform1i(this.uHasBLoc, 0);
      gl.uniform1f(this.uBlendAlphaLoc, 0.0);
    }

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return true;
  }

  dispose(): void {
    this.clearTextures();
    if (this.canvas) {
      this.canvas.removeEventListener("webglcontextlost", this.handleContextLost);
      this.canvas.removeEventListener("webglcontextrestored", this.handleContextRestored);
    }
    if (this.gl && !this.contextLost) {
      if (this.vao) this.gl.deleteVertexArray(this.vao);
      if (this.program) this.gl.deleteProgram(this.program);
    }
    this.vao = null;
    this.program = null;
    this.gl = null;
    this.canvas = null;
  }
}
