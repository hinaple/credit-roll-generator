import type { CreditConfig, CreditLayout, FramePlan, LayoutLine } from './types';

export function framePlan({ fps, duration, blankStart, blankEnd, durationMode, audioStart, audioDuration }: CreditConfig): FramePlan {
  const startFrames = Math.max(0, Math.round(blankStart * fps));
  const creditFrames = Math.max(1, Math.round(duration * fps));
  const endFrames = Math.max(0, Math.round(blankEnd * fps));
  const creditTotalFrames = startFrames + creditFrames + endFrames;
  const audioTotalFrames = Math.max(1, Math.round((audioStart + audioDuration) * fps));
  const totalFrames = durationMode === 'audio' ? audioTotalFrames : creditTotalFrames;
  return {
    startFrames,
    creditFrames,
    endFrames,
    totalFrames,
    start: startFrames / fps,
    duration: creditFrames / fps,
    end: endFrames / fps,
    total: totalFrames / fps,
    creditTotal: creditTotalFrames / fps,
  };
}

export function scrollYAt(time: number, config: CreditConfig, plan: FramePlan, layout: CreditLayout): number | null {
  if (time < plan.start || time >= plan.start + plan.duration) return null;
  const progress = (time - plan.start) / plan.duration;
  return config.height - 1 + (-layout.visualHeight - (config.height - 1)) * progress;
}

function lowerBoundBaseline(lines: readonly LayoutLine[], value: number): number {
  let low = 0;
  let high = lines.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (lines[mid].baseline < value) low = mid + 1;
    else high = mid;
  }
  return low;
}

function upperBoundBaseline(lines: readonly LayoutLine[], value: number): number {
  let low = 0;
  let high = lines.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (lines[mid].baseline <= value) low = mid + 1;
    else high = mid;
  }
  return low;
}

export function visibleLineRange(layout: CreditLayout, offsetY: number, viewportHeight: number): { start: number; end: number } {
  if (!layout.lines.length) return { start: 0, end: 0 };
  const minBaseline = -offsetY - (layout.maxDescent ?? 0);
  const maxBaseline = viewportHeight - offsetY + (layout.maxAscent ?? 0);
  return {
    start: lowerBoundBaseline(layout.lines, minBaseline),
    end: upperBoundBaseline(layout.lines, maxBaseline),
  };
}

function lineOriginX(config: CreditConfig, line: LayoutLine): number {
  if (config.textAlign === 'left') return config.padding;
  if (config.textAlign === 'right') return config.width - config.padding - line.width;
  if (line.anchorStart !== null && line.anchorEnd !== null) {
    return config.width / 2 - (line.anchorStart + line.anchorEnd) / 2;
  }
  return (config.width - line.width) / 2;
}

export function paintCreditsAtTime(
  target: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  config: CreditConfig,
  layout: CreditLayout,
  time: number,
  plan: FramePlan = framePlan(config),
  imageSources: ReadonlyMap<string, CanvasImageSource> = new Map(),
): void {
  target.fillStyle = config.backgroundColor;
  target.fillRect(0, 0, config.width, config.height);

  const offsetY = scrollYAt(time, config, plan, layout);
  if (offsetY === null) return;

  target.save();
  target.beginPath();
  target.rect(0, 0, config.width, config.height);
  target.clip();
  target.textBaseline = 'alphabetic';
  target.textAlign = 'left';

  const { start, end } = visibleLineRange(layout, offsetY, config.height);
  for (let i = start; i < end; i++) {
    const line = layout.lines[i];
    if (!line.visible || !line.runs.length) continue;

    const lineTop = offsetY + line.baseline - line.ascent;
    const lineBottom = offsetY + line.baseline + line.descent;
    if (lineBottom < 0 || lineTop > config.height) continue;

    const originX = lineOriginX(config, line);
    for (const run of line.runs) {
      if (run.kind === 'width') continue;
      if (run.kind === 'image') {
        const image = imageSources.get(run.imageId);
        if (image) target.drawImage(image, originX + run.x, offsetY + line.baseline - run.height, run.width, run.height);
        continue;
      }
      target.font = run.font;
      target.fillStyle = run.color;
      target.fillText(run.text, originX + run.x, offsetY + line.baseline);
    }
  }
  target.restore();
}

export function paintCreditsFrame(
  target: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  config: CreditConfig,
  layout: CreditLayout,
  plan: FramePlan,
  frameIndex: number,
  imageSources: ReadonlyMap<string, CanvasImageSource> = new Map(),
): void {
  paintCreditsAtTime(target, config, layout, frameIndex / config.fps, plan, imageSources);
}
