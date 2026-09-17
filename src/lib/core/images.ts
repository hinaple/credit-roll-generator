import type { ImageAssetDraft, ResolvedImageAsset } from './types';

export const IMAGE_ID_RE = /^[A-Za-z0-9_-]+$/;

export function validateImageId(id: string, ids: readonly string[], currentIndex = -1): void {
  if (!id) throw new Error('이미지 ID를 입력하세요.');
  if (!IMAGE_ID_RE.test(id)) throw new Error('이미지 ID에는 영문, 숫자, _, -만 사용할 수 있습니다.');
  if (ids.some((other, index) => index !== currentIndex && other === id)) {
    throw new Error(`이미지 ID "${id}"가 중복됩니다.`);
  }
}

export function renameImageRefs(text: string, oldId: string, newId: string): string {
  const escaped = oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`\\{#img=${escaped}\\}`, 'g'), `{#img=${newId}}`);
}

function optionalDimension(raw: string, name: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} 값이 올바르지 않습니다.`);
  return value;
}

export function resolveImageSize(
  sourceWidth: number,
  sourceHeight: number,
  widthRaw: string,
  heightRaw: string,
  maxDefaultWidth: number,
): { width: number; height: number } {
  if (!(sourceWidth > 0) || !(sourceHeight > 0)) throw new Error('이미지 원본 크기를 확인할 수 없습니다.');
  const width = optionalDimension(widthRaw, '이미지 너비');
  const height = optionalDimension(heightRaw, '이미지 높이');

  if (width !== null && height !== null) return { width, height };
  if (width !== null) return { width, height: width * sourceHeight / sourceWidth };
  if (height !== null) return { width: height * sourceWidth / sourceHeight, height };

  if (sourceWidth <= maxDefaultWidth) return { width: sourceWidth, height: sourceHeight };
  const scale = maxDefaultWidth / sourceWidth;
  return { width: maxDefaultWidth, height: sourceHeight * scale };
}

export function resolveImages(images: readonly ImageAssetDraft[], maxDefaultWidth: number): ResolvedImageAsset[] {
  const loaded = images.filter((image) => image.sourceWidth > 0 && image.sourceHeight > 0);
  const ids = loaded.map((image) => image.id);
  return loaded.map((image, index) => {
    validateImageId(image.id, ids, index);
    const size = resolveImageSize(image.sourceWidth, image.sourceHeight, image.width, image.height, maxDefaultWidth);
    return {
      id: image.id,
      sourceWidth: image.sourceWidth,
      sourceHeight: image.sourceHeight,
      ...size,
    };
  });
}
