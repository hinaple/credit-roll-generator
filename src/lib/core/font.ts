import type { FontGroupDraft, ResolvedFontGroup } from './types';
import { validateFontGroupId } from './parser';

export const DEFAULT_FONT_URL = 'https://rawcdn.githack.com/orioncactus/pretendard/refs/heads/main/packages/pretendard/dist/web/variable/woff2/PretendardVariable.woff2';

export function createInitialFontGroups(): FontGroupDraft[] {
  return [
    { id: '0', fontUrl: DEFAULT_FONT_URL, fontSize: '36', fontWeight: '400', lineHeight: '2', color: '#ffffff' },
    { id: 'b', fontUrl: '', fontSize: '48', fontWeight: '800', lineHeight: '2.2', color: '' },
  ];
}

function optionalNumberValue(raw: string, fallback: number, name: string, { min = -Infinity, max = Infinity } = {}): number {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return fallback;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${name} 값이 올바르지 않습니다.`);
  return value;
}

function resolveLineHeight(value: string, fontSize: number): number {
  const raw = String(value).trim();
  if (!raw) throw new Error('행간을 입력하세요.');
  if (/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(raw)) {
    const ratio = Number(raw);
    if (!(ratio > 0)) throw new Error('행간은 0보다 커야 합니다.');
    return ratio * fontSize;
  }

  const probe = document.createElement('span');
  probe.style.cssText = `position:absolute;visibility:hidden;font-size:${fontSize}px;line-height:${raw}`;
  probe.textContent = 'M';
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe).lineHeight;
  probe.remove();
  const px = Number.parseFloat(computed);
  if (!Number.isFinite(px) || px <= 0) throw new Error('행간은 단위 없는 배율 또는 올바른 CSS 값이어야 합니다.');
  return px;
}

function validateCssColor(value: string, name: string): string {
  if (!CSS.supports('color', value)) throw new Error(`${name} 값이 올바른 CSS 색상이 아닙니다.`);
  return value;
}

interface UnloadedFontGroup extends Omit<ResolvedFontGroup, 'fontFamily' | 'font'> {}

function resolveDrafts(drafts: readonly FontGroupDraft[]): UnloadedFontGroup[] {
  const base = drafts[0];
  if (!base) throw new Error('기본 글꼴이 없습니다.');
  const ids = drafts.map((group) => group.id);
  validateFontGroupId(base.id, ids, 0);

  const baseFontSize = optionalNumberValue(base.fontSize, Number.NaN, '기본 글자 크기', { min: 1 });
  const baseFontWeight = optionalNumberValue(base.fontWeight, Number.NaN, '기본 굵기', { min: 1, max: 1000 });
  const baseLineHeightRaw = base.lineHeight.trim();
  const baseColor = validateCssColor(base.color.trim(), '기본 글자색');
  if (!Number.isFinite(baseFontSize)) throw new Error('기본 글자 크기를 입력하세요.');
  if (!Number.isFinite(baseFontWeight)) throw new Error('기본 굵기를 입력하세요.');
  if (!baseLineHeightRaw) throw new Error('기본 행간을 입력하세요.');

  return drafts.map((group, index) => {
    validateFontGroupId(group.id, ids, index);
    const fontSize = index === 0
      ? baseFontSize
      : optionalNumberValue(group.fontSize, baseFontSize, `글꼴 그룹 ${group.id} 글자 크기`, { min: 1 });
    const fontWeight = index === 0
      ? baseFontWeight
      : optionalNumberValue(group.fontWeight, baseFontWeight, `글꼴 그룹 ${group.id} 굵기`, { min: 1, max: 1000 });
    const lineHeightRaw = index === 0 ? baseLineHeightRaw : group.lineHeight.trim() || baseLineHeightRaw;
    const fontUrl = index === 0 ? base.fontUrl.trim() : group.fontUrl.trim() || base.fontUrl.trim();
    const color = index === 0
      ? baseColor
      : validateCssColor(group.color.trim() || baseColor, `글꼴 그룹 ${group.id} 글자색`);

    return {
      id: group.id,
      fontUrl,
      fontSize,
      fontWeight,
      lineHeightRaw,
      lineHeight: resolveLineHeight(lineHeightRaw, fontSize),
      color,
    };
  });
}

export class BrowserFontRegistry {
  private faces: FontFace[] = [];
  private signature = '';
  private familiesByUrl = new Map<string, string>();
  private generation = 0;

  async resolve(drafts: readonly FontGroupDraft[]): Promise<ResolvedFontGroup[]> {
    const groups = resolveDrafts(drafts);
    const urls = [...new Set(groups.map((group) => group.fontUrl).filter(Boolean))];
    const signature = JSON.stringify(urls);

    if (signature !== this.signature) {
      const nextFaces: FontFace[] = [];
      const nextFamilies = new Map<string, string>();
      const generation = ++this.generation;
      try {
        for (let i = 0; i < urls.length; i++) {
          const url = urls[i];
          const family = `CreditGeneratorFont_${generation}_${i}`;
          const face = new FontFace(family, `url(${JSON.stringify(url)})`);
          document.fonts.add(face);
          await face.load();
          nextFaces.push(face);
          nextFamilies.set(url, family);
        }
      } catch (error) {
        for (const face of nextFaces) document.fonts.delete(face);
        throw error;
      }
      for (const face of this.faces) document.fonts.delete(face);
      this.faces = nextFaces;
      this.familiesByUrl = nextFamilies;
      this.signature = signature;
    }

    return groups.map((group) => {
      const fontFamily = group.fontUrl ? this.familiesByUrl.get(group.fontUrl) ?? 'Arial, sans-serif' : 'Arial, sans-serif';
      return {
        ...group,
        fontFamily,
        font: `${group.fontWeight} ${group.fontSize}px ${fontFamily}`,
      };
    });
  }

  dispose(): void {
    for (const face of this.faces) document.fonts.delete(face);
    this.faces = [];
    this.signature = '';
    this.familiesByUrl.clear();
  }
}
