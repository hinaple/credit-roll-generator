<script lang="ts">
  import type { DurationMode } from '../lib/core/types';

  interface Props {
    durationMode: DurationMode;
    volume: number;
    audioStart: number;
    audioInfo: string;
    onDurationMode: (value: DurationMode) => void;
    onVolume: (value: number) => void;
    onAudioStart: (value: number) => void;
    onFile: (file: File | null) => void;
  }

  let { durationMode, volume, audioStart, audioInfo, onDurationMode, onVolume, onAudioStart, onFile }: Props = $props();
  const numeric = (event: Event) => Number((event.currentTarget as HTMLInputElement).value);
</script>

<div class="audio-grid">
  <label class="file-field">
    음성 파일
    <input type="file" accept="audio/*" onchange={(event) => onFile((event.currentTarget as HTMLInputElement).files?.[0] ?? null)} />
  </label>
  <label>
    결과 길이 기준
    <select value={durationMode} onchange={(event) => onDurationMode((event.currentTarget as HTMLSelectElement).value as DurationMode)}>
      <option value="credit">크레딧 길이</option>
      <option value="audio">음성 파일 길이</option>
    </select>
  </label>
  <label>볼륨 <input type="number" min="0" max="2" step="0.05" value={volume} oninput={(event) => onVolume(numeric(event))} /></label>
  <label>음성 시작 (초) <input type="number" min="0" step="0.1" value={audioStart} oninput={(event) => onAudioStart(numeric(event))} /></label>
</div>
<p class="muted">{audioInfo}</p>
