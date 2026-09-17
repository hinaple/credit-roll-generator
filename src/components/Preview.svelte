<script lang="ts">
  import { onDestroy } from 'svelte';
  import { framePlan, paintCreditsAtTime } from '../lib/core/render';
  import type { CreditConfig, CreditLayout } from '../lib/core/types';

  interface Props {
    config: CreditConfig | null;
    layout: CreditLayout | null;
    imageSources: ReadonlyMap<string, CanvasImageSource>;
  }

  let { config, layout, imageSources }: Props = $props();
  let canvas: HTMLCanvasElement | undefined;
  let currentTime = $state(0);
  let playing = $state(false);
  let animationFrame = 0;
  let playStartedAt = 0;

  const total = $derived(config ? framePlan(config).total : 0);

  function draw() {
    if (!canvas || !config || !layout) return;
    if (canvas.width !== config.width) canvas.width = config.width;
    if (canvas.height !== config.height) canvas.height = config.height;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) return;
    paintCreditsAtTime(context, config, layout, currentTime, framePlan(config), imageSources);
  }

  $effect(() => {
    config;
    layout;
    imageSources;
    currentTime;
    draw();
  });

  $effect(() => {
    if (currentTime > total) currentTime = total;
  });

  function stop() {
    playing = false;
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  }

  function tick(now: number) {
    if (!playing) return;
    currentTime = Math.min(total, Math.max(0, (now - playStartedAt) / 1000));
    if (currentTime >= total) {
      stop();
      return;
    }
    animationFrame = requestAnimationFrame(tick);
  }

  function togglePlay() {
    if (!config || !layout || total <= 0) return;
    if (playing) {
      stop();
      return;
    }
    if (currentTime >= total) currentTime = 0;
    playing = true;
    playStartedAt = performance.now() - currentTime * 1000;
    animationFrame = requestAnimationFrame(tick);
  }

  function restart() {
    stop();
    currentTime = 0;
  }

  function seek(event: Event) {
    currentTime = Number((event.currentTarget as HTMLInputElement).value);
    if (playing) playStartedAt = performance.now() - currentTime * 1000;
  }

  onDestroy(stop);
</script>

<div class="section-heading">
  <div><h2>미리보기</h2></div>
  <div class="preview-controls">
    <button type="button" aria-pressed={playing} onclick={togglePlay}>{playing ? '일시정지' : '재생'}</button>
    <button type="button" onclick={restart}>처음부터</button>
  </div>
</div>

<canvas bind:this={canvas}></canvas>
<div class="timeline-row">
  <input
    type="range"
    min="0"
    max={Math.max(total, 0.001)}
    step="0.001"
    value={Math.min(currentTime, total)}
    aria-label="미리보기 타임라인"
    oninput={seek}
  />
  <span>{currentTime.toFixed(3)} / {total.toFixed(3)}초</span>
</div>
