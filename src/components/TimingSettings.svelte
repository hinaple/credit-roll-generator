<script lang="ts">
  interface Props {
    duration: number;
    blankStart: number;
    blankEnd: number;
    onDuration: (value: number) => void;
    onBlankStart: (value: number) => void;
    onBlankEnd: (value: number) => void;
  }
  let { duration, blankStart, blankEnd, onDuration, onBlankStart, onBlankEnd }: Props = $props();
  const numeric = (event: Event) => Number((event.currentTarget as HTMLInputElement).value);
</script>

<div class="grid">
  <label>크레딧 길이 (초) <input type="number" min="0.001" step="0.1" value={duration} oninput={(event) => onDuration(numeric(event))} /></label>
  <label>시작 공백 (초) <input type="number" min="0" step="0.1" value={blankStart} oninput={(event) => onBlankStart(numeric(event))} /></label>
  <label>끝 공백 (초) <input type="number" min="0" step="0.1" value={blankEnd} oninput={(event) => onBlankEnd(numeric(event))} /></label>
</div>
