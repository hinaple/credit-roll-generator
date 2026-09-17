import {
  materializeRichInlineLineRange,
  prepareRichInline,
  walkRichInlineLineRanges,
  type RichInlineLineRange,
} from '@chenglou/pretext/rich-inline';
import { resolveImages } from './images';
import { parseSource, splitIntoLogicalLines } from './parser';
import type {
  CreditLayout,
  ImageAssetDraft,
  LayoutLine,
  LayoutRun,
  LogicalItem,
  ResolvedFontGroup,
  ResolvedImageAsset,
} from './types';

const SPACER_CHAR = '\u200b';

function metricsForRun(measure: CanvasRenderingContext2D, text: string, style: { font: string; fontSize: number }) {
  if (!text || !text.trim()) return { ascent: 0, descent: 0, visible: false };
  measure.font = style.font;
  const metrics = measure.measureText(text);
  return {
    ascent: metrics.actualBoundingBoxAscent || style.fontSize * 0.8,
    descent: metrics.actualBoundingBoxDescent || style.fontSize * 0.2,
    visible: true,
  };
}

function finalizeLine(
  runs: LayoutRun[],
  width: number,
  measure: CanvasRenderingContext2D,
  baseStyle: ResolvedFontGroup,
  forcedHeight: number | null = null,
): LayoutLine {
  if (forcedHeight != null) {
    return { runs: [], width: 0, lineHeight: forcedHeight, ascent: 0, descent: 0, visible: false, baseline: 0, anchorStart: null, anchorEnd: null };
  }
  if (!runs.length) {
    return { runs: [], width: 0, lineHeight: baseStyle.lineHeight, ascent: 0, descent: 0, visible: false, baseline: 0, anchorStart: null, anchorEnd: null };
  }

  let lineHeight = 0;
  let ascent = 0;
  let descent = 0;
  let visible = false;
  let anchorStart = Infinity;
  let anchorEnd = -Infinity;

  for (const run of runs) {
    lineHeight = Math.max(lineHeight, run.lineHeight ?? baseStyle.lineHeight);
    if (run.anchor) {
      anchorStart = Math.min(anchorStart, run.x);
      anchorEnd = Math.max(anchorEnd, run.x + run.width);
    }
    if (run.kind === 'width') continue;
    if (run.kind === 'image') {
      visible = true;
      ascent = Math.max(ascent, run.height);
      continue;
    }
    const metrics = metricsForRun(measure, run.text, run);
    if (metrics.visible) {
      visible = true;
      ascent = Math.max(ascent, metrics.ascent);
      descent = Math.max(descent, metrics.descent);
    }
  }

  return {
    runs,
    width,
    lineHeight: lineHeight || baseStyle.lineHeight,
    ascent,
    descent,
    visible,
    baseline: 0,
    anchorStart: Number.isFinite(anchorStart) ? anchorStart : null,
    anchorEnd: Number.isFinite(anchorEnd) ? anchorEnd : null,
  };
}

function createImageLine(image: ResolvedImageAsset, measure: CanvasRenderingContext2D, baseStyle: ResolvedFontGroup): LayoutLine {
  const run: LayoutRun = {
    kind: 'image',
    imageId: image.id,
    x: 0,
    width: image.width,
    height: image.height,
    lineHeight: image.height,
    anchor: false,
  };
  return finalizeLine([run], image.width, measure, baseStyle);
}

function layoutUnwrappedLine(
  items: readonly LogicalItem[],
  stylesById: ReadonlyMap<string, ResolvedFontGroup>,
  measure: CanvasRenderingContext2D,
  baseStyle: ResolvedFontGroup,
): LayoutLine[] {
  let x = 0;
  const runs: LayoutRun[] = [];
  for (const item of items) {
    if (item.kind === 'width') {
      runs.push({ kind: 'width', x, width: item.width, lineHeight: baseStyle.lineHeight, anchor: item.anchor });
      x += item.width;
      continue;
    }
    if (!item.text) continue;
    const style = stylesById.get(item.groupId);
    if (!style) throw new Error(`존재하지 않는 글꼴 그룹 "${item.groupId}"가 사용되었습니다.`);
    measure.font = style.font;
    const width = measure.measureText(item.text).width;
    runs.push({
      kind: 'text',
      text: item.text,
      x,
      width,
      font: style.font,
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
      color: style.color,
      anchor: item.anchor,
    });
    x += width;
  }
  return [finalizeLine(runs, x, measure, baseStyle)];
}

function layoutWrappedLine(
  items: readonly LogicalItem[],
  stylesById: ReadonlyMap<string, ResolvedFontGroup>,
  measure: CanvasRenderingContext2D,
  baseStyle: ResolvedFontGroup,
  contentWidth: number,
): LayoutLine[] {
  if (!items.length) return [finalizeLine([], 0, measure, baseStyle)];

  const richItems = items.map((item) => {
    if (item.kind === 'width') {
      return { kind: 'width' as const, text: SPACER_CHAR, font: '1px Arial', extraWidth: item.width, groupId: null, anchor: item.anchor };
    }
    const style = stylesById.get(item.groupId);
    if (!style) throw new Error(`존재하지 않는 글꼴 그룹 "${item.groupId}"가 사용되었습니다.`);
    return { kind: 'text' as const, text: item.text, font: style.font, extraWidth: 0, groupId: item.groupId, anchor: item.anchor };
  });

  const prepared = prepareRichInline(richItems.map((item) => ({
    text: item.text,
    font: item.font,
    break: item.kind === 'width' ? 'never' : 'normal',
    extraWidth: item.extraWidth,
  })));

  const lines: LayoutLine[] = [];
  walkRichInlineLineRanges(prepared, contentWidth, (range: RichInlineLineRange) => {
    const materialized = materializeRichInlineLineRange(prepared, range);
    const runs: LayoutRun[] = [];
    let x = 0;
    for (const fragment of materialized.fragments) {
      const source = richItems[fragment.itemIndex];
      x += fragment.gapBefore;
      if (source.kind === 'width') {
        runs.push({ kind: 'width', x, width: fragment.occupiedWidth, lineHeight: baseStyle.lineHeight, anchor: source.anchor });
      } else {
        const style = stylesById.get(source.groupId!);
        if (!style) throw new Error(`존재하지 않는 글꼴 그룹 "${source.groupId}"가 사용되었습니다.`);
        runs.push({
          kind: 'text',
          text: fragment.text,
          x,
          width: fragment.occupiedWidth,
          font: style.font,
          fontSize: style.fontSize,
          lineHeight: style.lineHeight,
          color: style.color,
          anchor: source.anchor,
        });
      }
      x += fragment.occupiedWidth;
    }
    lines.push(finalizeLine(runs, materialized.width, measure, baseStyle));
  });

  const sourceHasAnchor = items.some((item) => item.anchor);
  const anchorLines = lines.filter((line) => line.anchorStart !== null);
  if (sourceHasAnchor && anchorLines.length !== 1) {
    throw new Error('anchor 영역은 자동 줄바꿈 후 한 줄 안에 들어가야 합니다.');
  }
  return lines.length ? lines : [finalizeLine([], 0, measure, baseStyle)];
}

export interface LayoutOptions {
  wrap: boolean;
  width: number;
  padding: number;
  images?: readonly ImageAssetDraft[];
}

export function layoutCredits(
  text: string,
  groups: readonly ResolvedFontGroup[],
  { wrap, width, padding, images = [] }: LayoutOptions,
): CreditLayout {
  const groupMap = new Map(groups.map((group) => [group.id, group]));
  const groupIds = new Set(groupMap.keys());
  const contentWidth = width - padding * 2;
  const resolvedImages = resolveImages(images, contentWidth);
  const imageMap = new Map(resolvedImages.map((image) => [image.id, image]));
  const logicalLines = splitIntoLogicalLines(parseSource(text, groupIds, new Set(imageMap.keys())));
  const measure = document.createElement('canvas').getContext('2d');
  if (!measure) throw new Error('2D Canvas context를 만들 수 없습니다.');
  measure.textBaseline = 'alphabetic';
  const baseStyle = groups[0];
  if (!baseStyle) throw new Error('기본 글꼴이 없습니다.');
  const lines: LayoutLine[] = [];

  for (const logicalLine of logicalLines) {
    if (logicalLine.spacerHeight != null) {
      lines.push(finalizeLine([], 0, measure, baseStyle, logicalLine.spacerHeight));
      continue;
    }
    if (logicalLine.imageId) {
      const image = imageMap.get(logicalLine.imageId);
      if (!image) throw new Error(`존재하지 않는 이미지 "${logicalLine.imageId}"가 사용되었습니다.`);
      lines.push(createImageLine(image, measure, baseStyle));
      continue;
    }
    const emptyStyle = groupMap.get(logicalLine.emptyGroupId) ?? baseStyle;
    const laidOut = wrap
      ? layoutWrappedLine(logicalLine.items, groupMap, measure, emptyStyle, contentWidth)
      : layoutUnwrappedLine(logicalLine.items, groupMap, measure, emptyStyle);
    lines.push(...laidOut);
  }

  let rawBaseline = 0;
  let previousLineHeight = 0;
  let inkTop = Infinity;
  let inkBottom = -Infinity;
  let maxAscent = 0;
  let maxDescent = 0;
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) rawBaseline += previousLineHeight;
    const line = lines[i];
    line.baseline = rawBaseline;
    previousLineHeight = line.lineHeight;
    maxAscent = Math.max(maxAscent, line.ascent);
    maxDescent = Math.max(maxDescent, line.descent);
    if (!line.visible) continue;
    inkTop = Math.min(inkTop, rawBaseline - line.ascent);
    inkBottom = Math.max(inkBottom, rawBaseline + line.descent);
  }

  if (!Number.isFinite(inkTop) || !Number.isFinite(inkBottom)) throw new Error('표시할 수 있는 문자 또는 이미지가 없습니다.');
  for (const line of lines) line.baseline -= inkTop;
  const totalAdvance = lines.length ? lines.at(-1)!.baseline + lines.at(-1)!.lineHeight : 0;
  const visualHeight = Math.max(inkBottom - inkTop, totalAdvance);
  const fonts = [...new Map(
    groups.filter((group) => group.fontUrl).map((group) => [group.fontFamily, { family: group.fontFamily, url: group.fontUrl }]),
  ).values()];

  return {
    lines,
    visualHeight: Math.max(1, visualHeight),
    maxAscent,
    maxDescent,
    fonts,
  };
}
