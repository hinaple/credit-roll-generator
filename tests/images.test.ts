import { describe, expect, it } from 'vitest';
import { renameImageRefs, resolveImageSize } from '../src/lib/core/images';

describe('image sizing', () => {
  it('uses source size until it reaches the available width', () => {
    expect(resolveImageSize(800, 400, '', '', 1000)).toEqual({ width: 800, height: 400 });
    expect(resolveImageSize(1600, 800, '', '', 1000)).toEqual({ width: 1000, height: 500 });
  });

  it('keeps aspect ratio when one dimension is supplied', () => {
    expect(resolveImageSize(800, 400, '400', '', 1000)).toEqual({ width: 400, height: 200 });
    expect(resolveImageSize(800, 400, '', '300', 1000)).toEqual({ width: 600, height: 300 });
  });

  it('uses both explicit dimensions without preserving aspect ratio', () => {
    expect(resolveImageSize(800, 400, '300', '500', 1000)).toEqual({ width: 300, height: 500 });
  });

  it('renames image directives', () => {
    expect(renameImageRefs('{#img=1} x {#img=1}', '1', 'logo')).toBe('{#img=logo} x {#img=logo}');
  });
});
