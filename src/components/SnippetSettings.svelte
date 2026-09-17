<script lang="ts">
  import type { Snippet } from '../lib/core/types';

  interface Props {
    snippets: Snippet[];
    onUpdate: (index: number, patch: Partial<Snippet>) => void;
    onRemove: (index: number) => void;
    onAdd: () => void;
  }

  let { snippets, onUpdate, onRemove, onAdd }: Props = $props();
</script>

<div class="snippets">
  {#each snippets as snippet, index}
    <section class="snippet-item">
      <div class="snippet-header">
        <h3>스니펫 {index + 1}</h3>
        <button type="button" disabled={snippets.length === 1} onclick={() => onRemove(index)}>삭제</button>
      </div>
      <label>
        검색 문자열
        <input
          type="text"
          value={snippet.search}
          spellcheck="false"
          oninput={(event) => onUpdate(index, { search: (event.currentTarget as HTMLInputElement).value })}
        />
      </label>
      <label>
        치환할 문자열
        <textarea
          class="snippet-replacement"
          rows="4"
          value={snippet.replacement}
          oninput={(event) => onUpdate(index, { replacement: (event.currentTarget as HTMLTextAreaElement).value })}
        ></textarea>
      </label>
    </section>
  {/each}
</div>
<button type="button" onclick={onAdd}>+ 스니펫 추가</button>
