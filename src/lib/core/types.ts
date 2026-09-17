export type TextAlign = 'left' | 'center' | 'right';
export type DurationMode = 'credit' | 'audio';

export interface FontGroupDraft {
  id: string;
  fontUrl: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  color: string;
}

export interface ResolvedFontGroup {
  id: string;
  fontUrl: string;
  fontSize: number;
  fontWeight: number;
  lineHeightRaw: string;
  lineHeight: number;
  color: string;
  fontFamily: string;
  font: string;
}

export interface ImageAssetDraft {
  key: string;
  id: string;
  width: string;
  height: string;
  fileName: string;
  sourceWidth: number;
  sourceHeight: number;
}

export interface ResolvedImageAsset {
  id: string;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
}

export interface Snippet {
  search: string;
  replacement: string;
}

export interface CreditConfig {
  text: string;
  wrap: boolean;
  textAlign: TextAlign;
  backgroundColor: string;
  padding: number;
  width: number;
  height: number;
  fps: number;
  duration: number;
  blankStart: number;
  blankEnd: number;
  durationMode: DurationMode;
  volume: number;
  audioStart: number;
  audioDuration: number;
}

export interface FramePlan {
  startFrames: number;
  creditFrames: number;
  endFrames: number;
  totalFrames: number;
  start: number;
  duration: number;
  end: number;
  total: number;
  creditTotal: number;
}

export interface LayoutFont {
  family: string;
  url: string;
}

export interface LayoutTextRun {
  kind: 'text';
  text: string;
  x: number;
  width: number;
  font: string;
  fontSize: number;
  lineHeight: number;
  color: string;
  anchor: boolean;
}

export interface LayoutWidthRun {
  kind: 'width';
  x: number;
  width: number;
  lineHeight: number;
  anchor: boolean;
}

export interface LayoutImageRun {
  kind: 'image';
  imageId: string;
  x: number;
  width: number;
  height: number;
  lineHeight: number;
  anchor: false;
}

export type LayoutRun = LayoutTextRun | LayoutWidthRun | LayoutImageRun;

export interface LayoutLine {
  runs: LayoutRun[];
  width: number;
  lineHeight: number;
  ascent: number;
  descent: number;
  visible: boolean;
  baseline: number;
  anchorStart: number | null;
  anchorEnd: number | null;
}

export interface CreditLayout {
  lines: LayoutLine[];
  visualHeight: number;
  maxAscent: number;
  maxDescent: number;
  fonts: LayoutFont[];
}

export interface TextToken {
  kind: 'text';
  text: string;
  groupId: string;
  anchor: boolean;
}

export interface WidthToken {
  kind: 'width';
  value: number;
  anchor: boolean;
}

export interface HeightToken {
  kind: 'height';
  value: number;
  anchor: false;
}

export interface ImageToken {
  kind: 'image';
  id: string;
  anchor: false;
}

export type SourceToken = TextToken | WidthToken | HeightToken | ImageToken;

export interface LogicalTextItem {
  kind: 'text';
  text: string;
  groupId: string;
  anchor: boolean;
}

export interface LogicalWidthItem {
  kind: 'width';
  width: number;
  anchor: boolean;
}

export type LogicalItem = LogicalTextItem | LogicalWidthItem;

export interface LogicalLine {
  items: LogicalItem[];
  emptyGroupId: string;
  spacerHeight?: number;
  imageId?: string;
}

export interface ExportProgress {
  frame: number;
  total: number;
}
