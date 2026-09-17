import type { Snippet } from './types';

export function applySnippets(source: string, snippets: readonly Snippet[]): string {
  let result = source;
  for (const snippet of snippets) {
    if (!snippet.search) continue;
    result = result.split(snippet.search).join(snippet.replacement);
  }
  return result;
}
