/**
 * WebGPU Scrollytelling Renderer powered by Shaders.com (`shaders` v4.0.7)
 *
 * Uses `shaders/std` (`defineShader` + `createMediaTexture` + `registerMediaTexture`)
 * and `shaders/js` (`createShader` + `getWebGPUSupport`) to:
 *  - Upload decoded ImageBitmaps directly into a bounded VRAM `GpuMediaTexture` pool
 *    via `queue.copyExternalImageToTexture` (`tex.write(asset)`), then immediately
 *    close the ImageBitmap to keep system RAM near 0 MB.
 *  - Swap Frame A and Frame B textures in O(1) without recompiling pipelines.
 *  - Perform object-fit: cover UV mapping, single-pass Hermite cross-fade, and the
 *    perceptual vignette in one compiled WGSL fragment pass.
 *  - Update uniforms via `shader.update()` (zero React re-renders) and sleep at 0% GPU
 *    via `shader.pause()` / `shader.resume()` when scrolling settles.
 */

import { defineShader, math, type Expr, type GpuFragmentParams } from "shaders/std";
import { createShader, getWebGPUSupport, type ShaderInstance } from "shaders/js";
import type { GpuUploadableAsset, ScrollyRenderer } from "./gpuFrameRenderer";

type GpuMediaTexture = ReturnType<GpuFragmentParams["createMediaTexture"]>;
type GpuMediaTextureOptions = Parameters<GpuFragmentParams["createMediaTexture"]>[0];

interface CanvasTextureBridge {
  textures: Map<string, GpuMediaTexture>;
  freePool: GpuMediaTexture[];
  placeholder: GpuMediaTexture;
  texA: GpuMediaTexture;
  texB: GpuMediaTexture;
  createMediaTexture: (opts: GpuMediaTextureOptions) => GpuMediaTexture;
}

const canvasBridges = new WeakMap<HTMLCanvasElement, CanvasTextureBridge>();

const ScrollyBlendShader = defineShader({
  name: "ScrollyBlend",
  props: {
    blendAlpha: { default: 0 },
    hasB: { default: 0 },
    scaleX: { default: 1 },
    scaleY: { default: 1 },
    offsetX: { default: 0 },
    offsetY: { default: 0 },
  },
  gpu: {
    fragment: (params: GpuFragmentParams): Expr => {
      const placeholder = params.createMediaTexture({
        width: 1,
        height: 1,
        label: "ScrollyPlaceholder",
      });

      const bridge: CanvasTextureBridge = {
        textures: new Map(),
        freePool: [],
        placeholder,
        texA: placeholder,
        texB: placeholder,
        createMediaTexture: (opts) => params.createMediaTexture(opts),
      };
      canvasBridges.set(params.canvas, bridge);

      params.onCleanup(() => {
        for (const tex of bridge.textures.values()) {
          try {
            tex.destroy();
          } catch {}
        }
        bridge.textures.clear();
        for (const tex of bridge.freePool) {
          try {
            tex.destroy();
          } catch {}
        }
        bridge.freePool.length = 0;
        try {
          placeholder.destroy();
        } catch {}
        if (canvasBridges.get(params.canvas) === bridge) {
          canvasBridges.delete(params.canvas);
        }
      });

      const kitA = params.registerMediaTexture(() => bridge.texA.texture);
      const kitB = params.registerMediaTexture(() => bridge.texB.texture);

      const uv = params.uvContext ?? params.ctx.uv;
      const u = math.add(math.mul(uv.member("x"), params.uniforms.scaleX), params.uniforms.offsetX);
      const v = math.add(math.mul(uv.member("y"), params.uniforms.scaleY), params.uniforms.offsetY);
      const coverUv = math.local(math.vec2(u, v), "coverUv");

      const rawA = math.local(kitA.sample(coverUv), "rawA");
      const rawB = math.local(kitB.sample(coverUv), "rawB");

      const alpha = math.mul(params.uniforms.blendAlpha, params.uniforms.hasB);
      const blendedRgb = math.local(
        math.mix(rawA.member("rgb"), rawB.member("rgb"), alpha),
        "blendedRgb"
      );

      // Decode sRGB texture samples to linear light for Shaders' linear/sRGB output pipeline
      const linearRgb = math.local(
        math.pow(math.max(blendedRgb, math.splat3(0)), math.splat3(2.2)),
        "linearRgb"
      );

      // Subtle vignette matching CSS: bg-gradient-to-t from-black/50 via-transparent to-black/20
      const screenY = uv.member("y");
      const bottomVig = math.mul(math.sub(screenY, 0.5), 1.0);
      const topVig = math.mul(math.sub(0.5, screenY), 0.4);
      const vigAlpha = math.local(
        math.select(math.ge(screenY, 0.5), bottomVig, topVig),
        "vigAlpha"
      );
      const vigGain = math.pow(math.max(math.sub(1.0, vigAlpha), 0.0), 2.2);
      const finalRgb = math.mul(linearRgb, vigGain);

      return math.vec4(finalRgb, 1.0);
    },
  },
});

export class WebGpuScrollyRenderer implements ScrollyRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private shader: ShaderInstance | null = null;
  private ready = false;
  private disposed = false;
  private paused = false;

  async init(
    canvas: HTMLCanvasElement,
    onFatalError?: (reason: string) => void
  ): Promise<boolean> {
    this.canvas = canvas;
    try {
      const support = await getWebGPUSupport();
      if (!support.supported || this.disposed) {
        return false;
      }

      const instance = await createShader(
        canvas,
        {
          components: [
            {
              type: "ScrollyBlend",
              id: "scrolly",
              props: {
                blendAlpha: 0,
                hasB: 0,
                scaleX: 1,
                scaleY: 1,
                offsetX: 0,
                offsetY: 0,
              },
            },
          ],
        },
        {
          components: [ScrollyBlendShader],
          colorSpace: "srgb",
          toneMapping: "linear",
          disableTelemetry: true,
          observeElement: true,
          onError: (reason) => {
            if (this.disposed) return;
            const terminal = instance?.getFailureReason();
            if (terminal) {
              this.ready = false;
              onFatalError?.(terminal || reason);
            }
          },
        }
      );

      if (this.disposed) {
        instance.destroy();
        return false;
      }

      if (instance.getFailureReason()) {
        instance.destroy();
        return false;
      }

      this.shader = instance;
      this.ready = true;
      return true;
    } catch {
      return false;
    }
  }

  isReady(): boolean {
    if (!this.ready || !this.shader || !this.canvas) return false;
    if (this.shader.getFailureReason()) return false;
    return canvasBridges.has(this.canvas);
  }

  private getBridge(): CanvasTextureBridge | null {
    if (!this.canvas) return null;
    return canvasBridges.get(this.canvas) ?? null;
  }

  hasTexture(key: string): boolean {
    return this.getBridge()?.textures.has(key) ?? false;
  }

  getTextureCount(): number {
    return this.getBridge()?.textures.size ?? 0;
  }

  uploadTexture(key: string, asset: GpuUploadableAsset): boolean {
    const bridge = this.getBridge();
    if (!bridge || !this.isReady()) return false;
    if (bridge.textures.has(key)) return true;

    const w = "naturalWidth" in asset && asset.naturalWidth ? asset.naturalWidth : asset.width;
    const h = "naturalHeight" in asset && asset.naturalHeight ? asset.naturalHeight : asset.height;
    if (!w || !h) return false;

    try {
      const poolIdx = bridge.freePool.findIndex((t) => t.width === w && t.height === h);
      const tex =
        poolIdx !== -1
          ? bridge.freePool.splice(poolIdx, 1)[0]
          : bridge.createMediaTexture({
              width: w,
              height: h,
              label: key,
            });
      tex.write(asset);
      bridge.textures.set(key, tex);
      return true;
    } catch {
      return false;
    }
  }

  evictTexture(key: string): void {
    const bridge = this.getBridge();
    if (!bridge) return;
    const tex = bridge.textures.get(key);
    if (tex) {
      if (bridge.texA === tex) bridge.texA = bridge.placeholder;
      if (bridge.texB === tex) bridge.texB = bridge.placeholder;
      bridge.textures.delete(key);
      if (bridge.freePool.length < 14) {
        bridge.freePool.push(tex);
      } else {
        try {
          tex.destroy();
        } catch {}
      }
    }
  }

  clearTextures(): void {
    const bridge = this.getBridge();
    if (!bridge) return;
    bridge.texA = bridge.placeholder;
    bridge.texB = bridge.placeholder;
    for (const tex of bridge.textures.values()) {
      try {
        tex.destroy();
      } catch {}
    }
    bridge.textures.clear();
    for (const tex of bridge.freePool) {
      try {
        tex.destroy();
      } catch {}
    }
    bridge.freePool.length = 0;
  }

  setPaused(paused: boolean): void {
    if (!this.shader || this.paused === paused) return;
    this.paused = paused;
    if (paused) {
      this.shader.pause();
    } else {
      this.shader.resume();
    }
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
    const bridge = this.getBridge();
    if (!bridge || !this.shader || !this.isReady()) return false;

    const texA = bridge.textures.get(keyA);
    if (!texA) return false;

    const texB = keyB ? bridge.textures.get(keyB) ?? null : null;
    bridge.texA = texA;
    bridge.texB = texB ?? bridge.placeholder;

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

    const hasB = texB && keyB !== keyA && blendAlpha > 0.001 ? 1 : 0;

    if (this.paused) {
      this.setPaused(false);
    }

    this.shader.update("scrolly", {
      scaleX,
      scaleY,
      offsetX,
      offsetY,
      blendAlpha: hasB ? blendAlpha : 0,
      hasB,
    });

    return true;
  }

  dispose(): void {
    this.disposed = true;
    this.ready = false;
    if (this.shader) {
      try {
        this.shader.destroy();
      } catch {}
      this.shader = null;
    }
    this.canvas = null;
  }
}
