import { describe, expect, it } from 'vitest';
import { applySnippets } from '../src/lib/core/snippets';

describe('snippet replacement', () => {
  it('replaces every exact match', () => {
    expect(applySnippets('a-a-a', [{ search: 'a', replacement: 'x' }])).toBe('x-x-x');
  });

  it('applies snippets from top to bottom', () => {
    expect(applySnippets('A', [
      { search: 'A', replacement: 'B' },
      { search: 'B', replacement: '<b>C</b>' },
    ])).toBe('<b>C</b>');
  });

  it('ignores an empty search string', () => {
    expect(applySnippets('abc', [{ search: '', replacement: 'x' }])).toBe('abc');
  });
});
