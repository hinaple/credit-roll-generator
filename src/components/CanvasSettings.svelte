<script lang="ts">
  import ColorInput from './ColorInput.svelte';

  interface Props {
    width: number;
    height: number;
    padding: number;
    fps: number;
    backgroundColor: string;
    onWidth: (value: number) => void;
    onHeight: (value: number) => void;
    onPadding: (value: number) => void;
    onFps: (value: number) => void;
    onBackgroundColor: (value: string) => void;
  }

  let { width, height, padding, fps, backgroundColor, onWidth, onHeight, onPadding, onFps, onBackgroundColor }: Props = $props();
  const numeric = (event: Event) => Number((event.currentTarget as HTMLInputElement).value);
</script>

<div class="canvas-row canvas-row-primary">
  <label>너비 <input type="number" min="2" step="1" value={width} oninput={(event) => onWidth(numeric(event))} /></label>
  <label>높이 <input type="number" min="2" step="1" value={height} oninput={(event) => onHeight(numeric(event))} /></label>
  <label>가로 여백 (px) <input type="number" min="0" step="1" value={padding} oninput={(event) => onPadding(numeric(event))} /></label>
</div>
<div class="canvas-row canvas-row-secondary">
  <label>프레임레이트 <input type="number" min="1" max="120" step="1" value={fps} oninput={(event) => onFps(numeric(event))} /></label>
  <ColorInput label="배경색" value={backgroundColor} onchange={onBackgroundColor} />
</div>
