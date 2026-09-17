<script lang="ts">
  interface Props {
    value: string;
    groupIds: string[];
    onchange: (value: string) => void;
  }

  let { value, groupIds, onchange }: Props = $props();

  function insertAtCursor(input: HTMLTextAreaElement, text: string, cursorOffset: number) {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    input.setRangeText(text, start, end, 'end');
    const cursor = start + cursorOffset;
    input.setSelectionRange(cursor, cursor);
  }

  function handleInput(event: Event) {
    const input = event.currentTarget as HTMLTextAreaElement;
    const inputEvent = event as InputEvent;
    if (!inputEvent.inputType?.startsWith('delete')) {
      const cursor = input.selectionStart;
      const before = input.value.slice(0, cursor);
      const after = input.value.slice(cursor);
      const tagMatch = before.match(/<([A-Za-z0-9_-]+)>$/);
      const anchorMatch = before.match(/\[#(a|anchor)\]$/);
      if (tagMatch && groupIds.includes(tagMatch[1]) && !after.startsWith(`</${tagMatch[1]}>`)) {
        insertAtCursor(input, `</${tagMatch[1]}>`, 0);
      } else if (anchorMatch && !after.startsWith(`[/${anchorMatch[1]}]`)) {
        insertAtCursor(input, `[/${anchorMatch[1]}]`, 0);
      } else if (before.endsWith('{#') && !after.startsWith('}')) {
        insertAtCursor(input, '}', 0);
      }
    }
    onchange(input.value);
  }
</script>

<section class="panel fixed-text-panel">
  <h2>크레딧 문구</h2>
  <textarea rows="10" value={value} oninput={handleInput}></textarea>
  <p class="muted">
    글꼴 그룹: <code>&lt;id&gt;텍스트&lt;/id&gt;</code> · anchor: <code>[#a]기준[/a]</code> · 가로 공간:
    <code>{'{#width=300}'}</code> · 세로 공간: <code>{'{#height=20}'}</code> · 이미지: <code>{'{#img=ID}'}</code>
  </p>
</section>
