import { describe, expect, it } from 'vitest';
import { parseSource, renameFontTags, splitIntoLogicalLines } from '../src/lib/core/parser';

const groups = new Set(['0', 'b']);

describe('credit parser', () => {
  it('keeps width as an inline spacer', () => {
    const lines = splitIntoLogicalLines(parseSource('test{#width=20}abc', groups));
    expect(lines).toHaveLength(1);
    expect(lines[0].items).toEqual([
      { kind: 'text', text: 'test', groupId: '0', anchor: false },
      { kind: 'width', width: 20, anchor: false },
      { kind: 'text', text: 'abc', groupId: '0', anchor: false },
    ]);
  });

  it('makes height its own spacer line and preserves an additional blank line', () => {
    const lines = splitIntoLogicalLines(parseSource('foo\n{#height=30}\n\nbar', groups));
    expect(lines).toHaveLength(4);
    expect(lines[0].items[0]).toMatchObject({ kind: 'text', text: 'foo' });
    expect(lines[1].spacerHeight).toBe(30);
    expect(lines[2].items).toHaveLength(0);
    expect(lines[3].items[0]).toMatchObject({ kind: 'text', text: 'bar' });
  });

  it('marks width inside anchor as part of the anchor', () => {
    const tokens = parseSource('x[#a]a{#width=25}b[/a]y', groups);
    expect(tokens).toEqual([
      { kind: 'text', text: 'x', groupId: '0', anchor: false },
      { kind: 'text', text: 'a', groupId: '0', anchor: true },
      { kind: 'width', value: 25, anchor: true },
      { kind: 'text', text: 'b', groupId: '0', anchor: true },
      { kind: 'text', text: 'y', groupId: '0', anchor: false },
    ]);
  });

  it('accepts the long anchor alias', () => {
    expect(() => parseSource('foo[#anchor]bar[/anchor]baz', groups)).not.toThrow();
  });

  it('rejects two anchors on the same source line', () => {
    expect(() => parseSource('[#a]a[/a]x[#a]b[/a]', groups)).toThrow('한 줄에는 anchor를 하나만 사용할 수 있습니다.');
  });

  it('rejects newline and height inside anchors', () => {
    expect(() => parseSource('[#a]a\nb[/a]', groups)).toThrow('anchor 내부에서는 개행할 수 없습니다.');
    expect(() => parseSource('[#a]a{#height=20}b[/a]', groups)).toThrow('anchor 내부에서는 {#height}를 사용할 수 없습니다.');
  });


  it('turns an image directive into its own logical line', () => {
    const images = new Set(['logo']);
    const lines = splitIntoLogicalLines(parseSource('foo\n{#img=logo}\nbar', groups, images));
    expect(lines).toHaveLength(3);
    expect(lines[0].items[0]).toMatchObject({ kind: 'text', text: 'foo' });
    expect(lines[1].imageId).toBe('logo');
    expect(lines[2].items[0]).toMatchObject({ kind: 'text', text: 'bar' });
  });

  it('rejects unknown images and images inside anchors', () => {
    expect(() => parseSource('{#img=missing}', groups, new Set())).toThrow('존재하지 않는 이미지');
    expect(() => parseSource('[#a]{#img=logo}[/a]', groups, new Set(['logo']))).toThrow('anchor 내부에서는 {#img}');
  });

  it('renames only font tags', () => {
    expect(renameFontTags('<b>x</b> b', 'b', 'title')).toBe('<title>x</title> b');
  });
});
