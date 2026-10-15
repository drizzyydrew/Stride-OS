import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

type RasterImage = {
  png(): RasterImage;
  toFile(target: string): Promise<unknown>;
  toBuffer(): Promise<Buffer>;
};
type Rasterizer = (input: Buffer) => RasterImage;

const require = createRequire(path.resolve('package.json'));
let rasterizer: Rasterizer | undefined;

export function firstsRasterizer(): Rasterizer {
  if (rasterizer) return rasterizer;
  const candidates = [
    process.env.STRIDEOS_SHARP_MODULE,
    'sharp',
    path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'),
  ].filter((candidate): candidate is string => Boolean(candidate));
  for (const candidate of candidates) {
    try {
      rasterizer = require(candidate) as Rasterizer;
      return rasterizer;
    } catch {
      // The bundled workspace runtime is the fallback on this build Mac.
    }
  }
  throw new Error('Firsts export requires sharp. Set STRIDEOS_SHARP_MODULE to an installed sharp module.');
}

export async function writeFirstsPng(svg: string, target: string): Promise<void> {
  await firstsRasterizer()(Buffer.from(svg)).png().toFile(target);
}
