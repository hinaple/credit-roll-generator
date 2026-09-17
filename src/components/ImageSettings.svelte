<script lang="ts">
  import type { ImageAssetDraft } from '../lib/core/types';

  interface Props {
    images: ImageAssetDraft[];
    onUpdate: (index: number, patch: Partial<ImageAssetDraft>) => void;
    onRename: (index: number, id: string) => boolean;
    onRemove: (index: number) => void;
    onAdd: () => void;
    onFile: (index: number, file: File | null) => void | Promise<void>;
  }

  let { images, onUpdate, onRename, onRemove, onAdd, onFile }: Props = $props();

  function inputValue(event: Event): string {
    return (event.currentTarget as HTMLInputElement).value;
  }
</script>

<div class="images">
  {#each images as image, index (image.key)}
    <section class="image-item">
      <div class="image-header">
        <div class="image-id-wrap">
          <h3>이미지 {index + 1}</h3>
          <label>
            ID
            <input
              class="image-id-input"
              type="text"
              value={image.id}
              spellcheck="false"
              onchange={(event) => {
                const input = event.currentTarget as HTMLInputElement;
                const id = input.value.trim();
                if (!onRename(index, id)) input.value = image.id;
              }}
            />
          </label>
        </div>
        <button type="button" onclick={() => onRemove(index)}>삭제</button>
      </div>

      <div class="image-grid">
        <label class="image-file-field">
          이미지 파일
          <input
            type="file"
            accept="image/*"
            onchange={(event) => void onFile(index, (event.currentTarget as HTMLInputElement).files?.[0] ?? null)}
          />
        </label>
        <label>
          너비 (px, 선택)
          <input
            type="number"
            min="0.001"
            step="1"
            value={image.width}
            placeholder={image.sourceWidth ? String(image.sourceWidth) : ''}
            oninput={(event) => onUpdate(index, { width: inputValue(event) })}
          />
        </label>
        <label>
          높이 (px, 선택)
          <input
            type="number"
            min="0.001"
            step="1"
            value={image.height}
            placeholder={image.sourceHeight ? String(image.sourceHeight) : ''}
            oninput={(event) => onUpdate(index, { height: inputValue(event) })}
          />
        </label>
      </div>

      <p class="muted image-info">
        {#if image.fileName}
          {image.fileName} · 원본 {image.sourceWidth}×{image.sourceHeight}px · <code>{`{#img=${image.id}}`}</code>
        {:else}
          파일을 선택하세요. · 사용 문법 <code>{`{#img=${image.id}}`}</code>
        {/if}
      </p>
    </section>
  {/each}
</div>

<button type="button" onclick={onAdd}>+ 이미지 추가</button>
<p class="muted">
  크기를 비워 두면 원본 크기를 사용하되 화면의 가용 너비를 넘지 않게 축소합니다. 한 축만 입력하면 비율을 유지하고, 두 축을 모두 입력하면 지정한 크기로 강제 조정합니다.
</p>
