import type { LogicalLine, SourceToken } from './types';

export const FONT_GROUP_ID_RE = /^[A-Za-z0-9_-]+$/;
const INLINE_ID_RE = /^[A-Za-z0-9_-]+$/;

export function renameFontTags(text: string, oldId: string, newId: string): string {
  const escaped = oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`<(/?)${escaped}>`, 'g'), `<$1${newId}>`);
}

export function validateFontGroupId(id: string, ids: readonly string[], currentIndex = -1): void {
  if (!id) throw new Error('글꼴 그룹 ID를 입력하세요.');
  if (!FONT_GROUP_ID_RE.test(id)) throw new Error('글꼴 그룹 ID에는 영문, 숫자, _, -만 사용할 수 있습니다.');
  if (id === '0' && currentIndex !== 0) throw new Error('ID 0은 기본 글꼴 전용입니다.');
  if (ids.some((other, index) => index !== currentIndex && other === id)) {
    throw new Error(`글꼴 그룹 ID "${id}"가 중복됩니다.`);
  }
}

export function parseSource(
  text: string,
  groupIds: ReadonlySet<string>,
  imageIds: ReadonlySet<string> = new Set(),
): SourceToken[] {
  const tokens: SourceToken[] = [];
  let activeId = '0';
  let openFontTag: string | null = null;
  let openAnchor: 'a' | 'anchor' | null = null;
  let anchorHasContent = false;
  let lineHasAnchor = false;
  let buffer = '';

  const isAnchored = () => openAnchor !== null;
  const flush = () => {
    if (!buffer) return;
    const anchor = isAnchored();
    const last = tokens.at(-1);
    if (last?.kind === 'text' && last.groupId === activeId && last.anchor === anchor) last.text += buffer;
    else tokens.push({ kind: 'text', text: buffer, groupId: activeId, anchor });
    if (anchor) anchorHasContent = true;
    buffer = '';
  };

  let i = 0;
  while (i < text.length) {
    if (text[i] === '\\' && ['<', '{', '['].includes(text[i + 1] ?? '')) {
      buffer += text[i + 1];
      if (isAnchored()) anchorHasContent = true;
      i += 2;
      continue;
    }

    if (text[i] === '\n') {
      if (isAnchored()) throw new Error('anchor 내부에서는 개행할 수 없습니다.');
      buffer += '\n';
      lineHasAnchor = false;
      i++;
      continue;
    }

    if (text.startsWith('[#a]', i) || text.startsWith('[#anchor]', i)) {
      const name: 'a' | 'anchor' = text.startsWith('[#anchor]', i) ? 'anchor' : 'a';
      if (openAnchor !== null) throw new Error('anchor는 중첩할 수 없습니다.');
      if (lineHasAnchor) throw new Error('한 줄에는 anchor를 하나만 사용할 수 있습니다.');
      flush();
      openAnchor = name;
      anchorHasContent = false;
      lineHasAnchor = true;
      i += name === 'anchor' ? 9 : 4;
      continue;
    }

    if (text.startsWith('[/a]', i) || text.startsWith('[/anchor]', i)) {
      const name: 'a' | 'anchor' = text.startsWith('[/anchor]', i) ? 'anchor' : 'a';
      if (openAnchor === null) throw new Error(`열리지 않은 anchor 닫는 태그 [/${name}]가 있습니다.`);
      if (openAnchor !== name) throw new Error(`[#${openAnchor}]는 [/${openAnchor}]로 닫아야 합니다.`);
      flush();
      if (!anchorHasContent) throw new Error('anchor 내부가 비어 있습니다.');
      openAnchor = null;
      anchorHasContent = false;
      i += name === 'anchor' ? 9 : 4;
      continue;
    }

    if (text.startsWith('{#', i)) {
      const end = text.indexOf('}', i + 2);
      if (end !== -1) {
        const body = text.slice(i + 2, end);
        const spacerMatch = body.match(/^(width|height)=(\d+(?:\.\d+)?)$/);
        if (spacerMatch) {
          const kind = spacerMatch[1] as 'width' | 'height';
          const value = Number(spacerMatch[2]);
          if (kind === 'height' && isAnchored()) throw new Error('anchor 내부에서는 {#height}를 사용할 수 없습니다.');
          flush();
          if (kind === 'width') {
            tokens.push({ kind, value, anchor: isAnchored() });
            if (isAnchored()) anchorHasContent = true;
          } else {
            tokens.push({ kind, value, anchor: false });
          }
          i = end + 1;
          if (kind === 'height') {
            lineHasAnchor = false;
            if (text[i] === '\n') i++;
          }
          continue;
        }

        const imageMatch = body.match(/^img=([A-Za-z0-9_-]+)$/);
        if (imageMatch) {
          const id = imageMatch[1];
          if (!INLINE_ID_RE.test(id)) throw new Error(`이미지 ID "${id}"가 올바르지 않습니다.`);
          if (isAnchored()) throw new Error('anchor 내부에서는 {#img}를 사용할 수 없습니다.');
          if (!imageIds.has(id)) throw new Error(`존재하지 않는 이미지 "${id}"가 사용되었습니다.`);
          flush();
          tokens.push({ kind: 'image', id, anchor: false });
          i = end + 1;
          lineHasAnchor = false;
          if (text[i] === '\n') i++;
          continue;
        }
      }
    }

    if (text[i] === '<') {
      const end = text.indexOf('>', i + 1);
      if (end !== -1) {
        const match = text.slice(i + 1, end).match(/^(\/)?([A-Za-z0-9_-]+)$/);
        if (match) {
          const closing = Boolean(match[1]);
          const id = match[2];
          if (!groupIds.has(id)) throw new Error(`존재하지 않는 글꼴 그룹 "${id}"가 사용되었습니다.`);
          flush();
          if (closing) {
            if (openFontTag !== id) {
              if (openFontTag === null) throw new Error(`열리지 않은 글꼴 태그 </${id}>가 있습니다.`);
              throw new Error(`글꼴 태그 <${openFontTag}> 안에서 </${id}>로 닫을 수 없습니다.`);
            }
            openFontTag = null;
            activeId = '0';
          } else {
            if (openFontTag !== null) throw new Error('글꼴 태그는 중첩할 수 없습니다.');
            openFontTag = id;
            activeId = id;
          }
          i = end + 1;
          continue;
        }
      }
    }

    buffer += text[i];
    if (isAnchored()) anchorHasContent = true;
    i++;
  }

  flush();
  if (openFontTag !== null) throw new Error(`글꼴 태그 <${openFontTag}>가 닫히지 않았습니다.`);
  if (openAnchor !== null) throw new Error(`anchor [#${openAnchor}]가 닫히지 않았습니다.`);
  return tokens;
}

export function splitIntoLogicalLines(tokens: readonly SourceToken[]): LogicalLine[] {
  const lines: LogicalLine[] = [{ items: [], emptyGroupId: '0' }];
  const current = () => lines.at(-1)!;
  const pushEmpty = (emptyGroupId = '0') => lines.push({ items: [], emptyGroupId });

  for (const token of tokens) {
    if (token.kind === 'height') {
      if (current().items.length || current().imageId) pushEmpty();
      current().spacerHeight = token.value;
      pushEmpty();
      continue;
    }

    if (token.kind === 'image') {
      if (current().items.length || current().spacerHeight != null || current().imageId) pushEmpty();
      current().imageId = token.id;
      pushEmpty();
      continue;
    }

    if (token.kind === 'width') {
      current().items.push({ kind: 'width', width: token.value, anchor: token.anchor });
      continue;
    }

    const parts = token.text.split('\n');
    for (let i = 0; i < parts.length; i++) {
      const line = current();
      if (line.imageId || line.spacerHeight != null) pushEmpty(token.groupId);
      const target = current();
      if (parts[i]) {
        const last = target.items.at(-1);
        if (last?.kind === 'text' && last.groupId === token.groupId && last.anchor === token.anchor) last.text += parts[i];
        else target.items.push({ kind: 'text', text: parts[i], groupId: token.groupId, anchor: token.anchor });
      } else if (!target.items.length) {
        target.emptyGroupId = token.groupId;
      }
      if (i < parts.length - 1) pushEmpty(token.groupId);
    }
  }

  const last = lines.at(-1)!;
  if (lines.length > 1 && !last.items.length && last.spacerHeight == null && !last.imageId) lines.pop();
  return lines;
}
