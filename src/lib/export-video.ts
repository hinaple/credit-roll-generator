import { framePlan } from './core/render';
import type { CreditConfig, CreditLayout, ExportProgress } from './core/types';

export interface ExportCallbacks {
  onProgress?: (progress: ExportProgress) => void;
  onStatus?: (message: string) => void;
}

export interface ExportImageSource {
  id: string;
  mimeType: string;
  data: ArrayBuffer;
}

interface AudioPayload {
  data: ArrayBuffer;
  sampleRate: number;
  numberOfChannels: number;
  numberOfFrames: number;
}

interface ImagePayload {
  id: string;
  mimeType: string;
  data: ArrayBuffer;
}

type WorkerResponse =
  | { type: 'progress'; frame: number; total: number }
  | { type: 'status'; message: string }
  | { type: 'done'; buffer: ArrayBuffer }
  | { type: 'error'; message: string };

export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  if (!window.AudioContext) throw new Error('이 브라우저에서는 Web Audio API를 사용할 수 없습니다.');
  const audioContext = new AudioContext();
  try {
    return await audioContext.decodeAudioData(await file.arrayBuffer());
  } finally {
    await audioContext.close();
  }
}

export function describeAudio(fileName: string, audio: AudioBuffer | null): string {
  if (!audio) return '음성 파일 없음';
  return `${fileName} / ${audio.duration.toFixed(3)}초 / ${audio.sampleRate}Hz / ${audio.numberOfChannels}채널`;
}

function createAudioPayload(audioBuffer: AudioBuffer | null): AudioPayload | null {
  if (!audioBuffer) return null;
  const numberOfChannels = audioBuffer.numberOfChannels;
  const numberOfFrames = audioBuffer.length;
  const planar = new Float32Array(numberOfChannels * numberOfFrames);
  for (let channel = 0; channel < numberOfChannels; channel++) {
    planar.set(audioBuffer.getChannelData(channel), channel * numberOfFrames);
  }
  return {
    data: planar.buffer,
    sampleRate: audioBuffer.sampleRate,
    numberOfChannels,
    numberOfFrames,
  };
}

function createImagePayloads(images: readonly ExportImageSource[]): ImagePayload[] {
  return images.map((image) => ({
    id: image.id,
    mimeType: image.mimeType,
    data: image.data.slice(0),
  }));
}

export function exportVideo(
  config: CreditConfig,
  layout: CreditLayout,
  audioBuffer: AudioBuffer | null,
  images: readonly ExportImageSource[],
  callbacks: ExportCallbacks = {},
): Promise<void> {
  callbacks.onStatus?.('시작 중...');
  const worker = new Worker(new URL('../workers/export.worker.ts', import.meta.url), { type: 'module' });
  const plan = framePlan(config);
  const audio = createAudioPayload(audioBuffer);
  const imagePayloads = createImagePayloads(images);

  return new Promise((resolve, reject) => {
    const finish = () => worker.terminate();

    worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
      if (data.type === 'progress') {
        callbacks.onProgress?.({ frame: data.frame, total: data.total });
      } else if (data.type === 'status') {
        callbacks.onStatus?.(data.message);
      } else if (data.type === 'done') {
        const blob = new Blob([data.buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'credits.mp4';
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        callbacks.onProgress?.({ frame: 1, total: 1 });
        callbacks.onStatus?.('완료');
        finish();
        resolve();
      } else if (data.type === 'error') {
        callbacks.onStatus?.('실패');
        finish();
        reject(new Error(data.message));
      }
    };

    worker.onerror = (event) => {
      callbacks.onStatus?.('실패');
      finish();
      reject(new Error(event.message || '내보내기 작업을 실행하지 못했습니다.'));
    };

    const transfer: Transferable[] = [];
    if (audio) transfer.push(audio.data);
    for (const image of imagePayloads) transfer.push(image.data);
    worker.postMessage({ type: 'export', config, layout, plan, audio, images: imagePayloads }, transfer);
  });
}
