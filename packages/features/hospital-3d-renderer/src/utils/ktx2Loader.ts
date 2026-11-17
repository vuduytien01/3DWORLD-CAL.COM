import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { CompressedTexture, RGBA_ASTC_4x4_Format, RGBA_BPTC_Format, RGBA_ETC2_EAC_Format, RGBA_PVRTC_4BPPV1_Format, SRGBColorSpace } from "three";

/**
 * KTX2 texture loader with GPU compression detection.
 * Supports ASTC, BC7, ETC2, PVRTC formats.
 */

let ktx2LoaderInstance: any = null;

export function getKTX2Loader(renderer: any): any {
  if (!ktx2LoaderInstance) {
    ktx2LoaderInstance = new KTX2Loader();
    ktx2LoaderInstance.detectSupport(renderer);
  }
  return ktx2LoaderInstance;
}

export async function loadKTX2Texture(
  renderer: any,
  url: string
): Promise<any> {
  const loader = getKTX2Loader(renderer);
  const texture = await loader.loadAsync(url);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/**
 * Detect best supported compressed texture format
 */
export function getSupportedCompressedFormat(renderer: any): string {
  const extensions = renderer.getContext().getExtension('WEBGL_compressed_texture_astc');
  if (extensions) return 'astc';

  const bppt = renderer.getContext().getExtension('EXT_texture_compression_bptc');
  if (bppt) return 'bptc';

  const etc = renderer.getContext().getExtension('WEBGL_compressed_texture_etc');
  if (etc) return 'etc2';

  const pvrtc = renderer.getContext().getExtension('WEBGL_compressed_texture_pvrtc');
  if (pvrtc) return 'pvrtc';

  return 'rgba'; // fallback
}

/**
 * Preload multiple KTX2 textures
 */
export async function preloadKTX2Textures(
  renderer: any,
  urls: string[]
): Promise<Map<string, any>> {
  const loader = getKTX2Loader(renderer);
  const textures = new Map<string, any>();

  await Promise.all(
    urls.map(async (url) => {
      const texture = await loader.loadAsync(url);
      texture.colorSpace = 'srgb';
      textures.set(url, texture);
    })
  );

  return textures;
}

/**
 * Dispose KTX2 loader
 */
export function disposeKTX2Loader(): void {
  if (ktx2LoaderInstance) {
    ktx2LoaderInstance.dispose();
    ktx2LoaderInstance = null;
  }
}

export { KTX2Loader };