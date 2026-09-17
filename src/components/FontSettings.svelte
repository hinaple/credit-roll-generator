<script lang="ts">
  import ColorInput from './ColorInput.svelte';
  import type { FontGroupDraft, TextAlign } from '../lib/core/types';

  interface Props {
    groups: FontGroupDraft[];
    wrap: boolean;
    textAlign: TextAlign;
    onWrap: (value: boolean) => void;
    onTextAlign: (value: TextAlign) => void;
    onUpdate: (index: number, patch: Partial<FontGroupDraft>) => void;
    onRename: (index: number, id: string) => boolean;
    onRemove: (index: number) => void;
    onAdd: () => void;
  }

  let {
    groups,
    wrap,
    textAlign,
    onWrap,
    onTextAlign,
    onUpdate,
    onRename,
    onRemove,
    onAdd,
  }: Props = $props();

  function inputValue(event: Event): string {
    return (event.currentTarget as HTMLInputElement).value;
  }
</script>

<div class="typography-options">
  <label class="inline"><input type="checkbox" checked={wrap} onchange={(event) => onWrap((event.currentTarget as HTMLInputElement).checked)} /> 자동 줄바꿈</label>
  <label>
    정렬
    <select value={textAlign} onchange={(event) => onTextAlign((event.currentTarget as HTMLSelectElement).value as TextAlign)}>
      <option value="left">왼쪽</option>
      <option value="center">가운데</option>
      <option value="right">오른쪽</option>
    </select>
  </label>
</div>

<div class="font-groups">
  {#each groups as group, index (group.id)}
    <section class="font-group">
      <div class="font-group-header">
        <div class="group-id-wrap">
          <h3>{index === 0 ? '기본 글꼴' : '글꼴 그룹'}</h3>
          {#if index === 0}
            <span class="muted">ID 0</span>
          {:else}
            <label>
              ID
              <input
                class="group-id-input"
                type="text"
                value={group.id}
                spellcheck="false"
                onchange={(event) => {
                  const input = event.currentTarget as HTMLInputElement;
                  const id = input.value.trim();
                  if (!onRename(index, id)) input.value = group.id;
                }}
              />
            </label>
          {/if}
        </div>
        {#if index > 0}<button type="button" onclick={() => onRemove(index)}>삭제</button>{/if}
      </div>

      <div class="font-group-grid">
        <label class="font-url-field">
          폰트 URL
          <input
            type="url"
            value={group.fontUrl}
            placeholder={index === 0 ? '' : groups[0].fontUrl}
            oninput={(event) => onUpdate(index, { fontUrl: inputValue(event) })}
          />
        </label>
        <label>
          글자 크기 (px)
          <input
            type="number"
            min="1"
            step="1"
            value={group.fontSize}
            placeholder={index === 0 ? '' : groups[0].fontSize}
            oninput={(event) => onUpdate(index, { fontSize: inputValue(event) })}
          />
        </label>
        <label>
          굵기
          <input
            type="number"
            min="1"
            max="1000"
            step="1"
            value={group.fontWeight}
            placeholder={index === 0 ? '' : groups[0].fontWeight}
            oninput={(event) => onUpdate(index, { fontWeight: inputValue(event) })}
          />
        </label>
        <label>
          행간
          <input
            type="text"
            value={group.lineHeight}
            placeholder={index === 0 ? '' : groups[0].lineHeight}
            oninput={(event) => onUpdate(index, { lineHeight: inputValue(event) })}
          />
        </label>
        <ColorInput
          label="글자색"
          value={group.color}
          placeholder={index === 0 ? '' : groups[0].color}
          onchange={(color) => onUpdate(index, { color })}
        />
      </div>
      {#if index > 0}<p class="inherit-hint">비워 둔 값은 기본 글꼴 값을 사용합니다.</p>{/if}
    </section>
  {/each}
</div>

<button type="button" onclick={onAdd}>+ 글꼴 그룹 추가</button>
