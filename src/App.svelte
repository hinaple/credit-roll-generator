<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import AudioSettings from './components/AudioSettings.svelte';
  import CanvasSettings from './components/CanvasSettings.svelte';
  import CreditEditor from './components/CreditEditor.svelte';
  import FontSettings from './components/FontSettings.svelte';
  import ImageSettings from './components/ImageSettings.svelte';
  import Preview from './components/Preview.svelte';
  import SnippetSettings from './components/SnippetSettings.svelte';
  import TimingSettings from './components/TimingSettings.svelte';
  import { decodeAudioFile, describeAudio, exportVideo, type ExportImageSource } from './lib/export-video';
  import { BrowserFontRegistry, createInitialFontGroups } from './lib/core/font';
  import { renameImageRefs, validateImageId } from './lib/core/images';
  import { layoutCredits } from './lib/core/layout';
  import { renameFontTags, validateFontGroupId } from './lib/core/parser';
  import { framePlan } from './lib/core/render';
  import { applySnippets } from './lib/core/snippets';
  import type {
    CreditConfig,
    CreditLayout,
    DurationMode,
    FontGroupDraft,
    ImageAssetDraft,
    Snippet,
    TextAlign,
  } from './lib/core/types';

  type Tab = 'typography' | 'images' | 'snippets' | 'canvas' | 'timing' | 'audio';

  interface ImageResource {
    data: ArrayBuffer;
    mimeType: string;
    bitmap: ImageBitmap;
  }

  type StoredImage = Omit<ImageAssetDraft, 'key'> & {
    mimeType?: string;
    dataBase64?: string;
  };

  interface StoredSettings {
    format: 'credit-roll-generator';
    version: 1;
    text: string;
    fontGroups: FontGroupDraft[];
    images: StoredImage[];
    snippets: Snippet[];
    wrap: boolean;
    textAlign: TextAlign;
    width: number;
    height: number;
    padding: number;
    fps: number;
    backgroundColor: string;
    duration: number;
    blankStart: number;
    blankEnd: number;
    durationMode: DurationMode;
    volume: number;
    audioStart: number;
  }

  const SETTINGS_KEY = 'credit-roll-generator:settings:v1';

  const DEFAULT_TEXT = `<b>SAMPLE</b>
테스트 크레딧
테스트 크레딧
테스트 크레딧
테스트 크레딧


<b>테스트</b>
sample credit
sample credit
sample credit
sample credit`;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'typography', label: '글꼴' },
    { id: 'images', label: '이미지' },
    { id: 'snippets', label: '스니펫' },
    { id: 'canvas', label: '화면' },
    { id: 'timing', label: '시간' },
    { id: 'audio', label: '음성' },
  ];

  let text = $state(DEFAULT_TEXT);
  let fontGroups = $state<FontGroupDraft[]>(createInitialFontGroups());
  let images = $state<ImageAssetDraft[]>([]);
  let snippets = $state<Snippet[]>([{ search: '', replacement: '' }]);
  let wrap = $state(true);
  let textAlign = $state<TextAlign>('center');
  let width = $state(1920);
  let height = $state(1080);
  let padding = $state(80);
  let fps = $state(30);
  let backgroundColor = $state('#000000');
  let duration = $state(30);
  let blankStart = $state(0);
  let blankEnd = $state(0);
  let durationMode = $state<DurationMode>('credit');
  let volume = $state(1);
  let audioStart = $state(0);
  let audioBuffer = $state.raw<AudioBuffer | null>(null);
  let audioFileName = $state('');
  let audioLoading = $state(false);
  let activeTab = $state<Tab>('typography');
  let error = $state('');
  let config = $state.raw<CreditConfig | null>(null);
  let layout = $state.raw<CreditLayout | null>(null);
  let exportProgress = $state(0);
  let exportStatus = $state('');
  let exporting = $state(false);

  const fontRegistry = new BrowserFontRegistry();
  const imageResources = new Map<string, ImageResource>();
  const imageLoadTokens = new Map<string, number>();
  let rebuildToken = 0;
  let rebuildTimer: ReturnType<typeof setTimeout> | null = null;
  let audioDecodeToken = 0;
  let nextFontGroupId = 1;
  let nextImageId = 1;
  let nextImageKey = 1;

  const groupIds = $derived(fontGroups.map((group) => group.id));
  const previewImages = $derived.by(() => {
    const map = new Map<string, CanvasImageSource>();
    for (const image of images) {
      const resource = imageResources.get(image.key);
      if (resource && image.id) map.set(image.id, resource.bitmap);
    }
    return map;
  });
  const audioInfo = $derived(audioLoading ? '음성 파일 읽는 중...' : describeAudio(audioFileName, audioBuffer));
  const info = $derived.by(() => {
    if (!config) return '';
    const plan = framePlan(config);
    const source = config.durationMode === 'audio' ? '음성' : '크레딧';
    return `${config.width}×${config.height} / ${config.fps} fps / ${plan.totalFrames}프레임 / ${plan.total.toFixed(3)}초 (${source} 기준)`;
  });

  function validateColor(value: string, name: string): string {
    if (!CSS.supports('color', value)) throw new Error(`${name} 값이 올바른 CSS 색상이 아닙니다.`);
    return value;
  }

  function validateNumber(value: number, name: string, min = -Infinity, max = Infinity): number {
    if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${name} 값이 올바르지 않습니다.`);
    return value;
  }

  function validateImages(): ImageAssetDraft[] {
    const ids = images.map((image) => image.id);
    images.forEach((image, index) => validateImageId(image.id, ids, index));
    return images.filter((image) => image.sourceWidth > 0 && image.sourceHeight > 0 && imageResources.has(image.key));
  }

  function readConfig(): CreditConfig {
    const normalizedText = applySnippets(text, snippets).replace(/\r\n?/g, '\n');
    if (!normalizedText.trim()) throw new Error('크레딧 문구를 입력하세요.');

    const nextWidth = Math.round(validateNumber(width, '너비', 2));
    const nextHeight = Math.round(validateNumber(height, '높이', 2));
    const nextPadding = validateNumber(padding, '가로 여백', 0);
    if (nextPadding * 2 >= nextWidth) throw new Error('가로 여백을 제외한 텍스트 영역의 너비가 0보다 커야 합니다.');
    const audioDuration = audioBuffer?.duration ?? 0;
    if (durationMode === 'audio' && audioDuration === 0) throw new Error('음성 파일 길이를 사용하려면 음성 파일을 추가하세요.');

    return {
      text: normalizedText,
      wrap,
      textAlign,
      backgroundColor: validateColor(backgroundColor.trim(), '배경색'),
      padding: nextPadding,
      width: nextWidth,
      height: nextHeight,
      fps: validateNumber(fps, '프레임레이트', 1, 120),
      duration: validateNumber(duration, '크레딧 길이', 0.001),
      blankStart: validateNumber(blankStart, '시작 공백', 0),
      blankEnd: validateNumber(blankEnd, '끝 공백', 0),
      durationMode,
      volume: validateNumber(volume, '볼륨', 0, 2),
      audioStart: validateNumber(audioStart, '음성 시작', 0),
      audioDuration,
    };
  }

  async function rebuild(): Promise<boolean> {
    const token = ++rebuildToken;
    try {
      error = '';
      const nextConfig = readConfig();
      const loadedImages = validateImages();
      const resolvedGroups = await fontRegistry.resolve(fontGroups);
      if (token !== rebuildToken) return false;
      const nextLayout = layoutCredits(nextConfig.text, resolvedGroups, {
        wrap: nextConfig.wrap,
        width: nextConfig.width,
        padding: nextConfig.padding,
        images: loadedImages,
      });
      if (token !== rebuildToken) return false;
      config = nextConfig;
      layout = nextLayout;
      return true;
    } catch (cause) {
      if (token !== rebuildToken) return false;
      error = cause instanceof Error ? cause.message : String(cause);
      return false;
    }
  }

  function scheduleRebuild() {
    if (rebuildTimer) clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(() => void rebuild(), 120);
  }

  $effect(() => {
    JSON.stringify({
      text,
      fontGroups,
      images: images.map(({ key, id, width, height, fileName, sourceWidth, sourceHeight }) => ({ key, id, width, height, fileName, sourceWidth, sourceHeight })),
      snippets,
      wrap,
      textAlign,
      width,
      height,
      padding,
      fps,
      backgroundColor,
      duration,
      blankStart,
      blankEnd,
      durationMode,
      volume,
      audioStart,
      audioDuration: audioBuffer?.duration ?? 0,
    });
    scheduleRebuild();
  });

  function isStoredSettings(value: unknown): value is StoredSettings {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const data = value as Partial<StoredSettings>;
    const numbers = [data.width, data.height, data.padding, data.fps, data.duration, data.blankStart, data.blankEnd, data.volume, data.audioStart];
    return data.format === 'credit-roll-generator'
      && data.version === 1
      && typeof data.text === 'string'
      && Array.isArray(data.fontGroups)
      && data.fontGroups.length > 0
      && Array.isArray(data.images)
      && Array.isArray(data.snippets)
      && typeof data.wrap === 'boolean'
      && (data.textAlign === 'left' || data.textAlign === 'center' || data.textAlign === 'right')
      && typeof data.backgroundColor === 'string'
      && (data.durationMode === 'credit' || data.durationMode === 'audio')
      && numbers.every((number) => typeof number === 'number' && Number.isFinite(number));
  }

  function parseStoredSettings(raw: string): StoredSettings | null {
    try {
      const value: unknown = JSON.parse(raw);
      return isStoredSettings(value) ? value : null;
    } catch {
      return null;
    }
  }

  function arrayBufferToBase64(data: ArrayBuffer): string {
    const bytes = new Uint8Array(data);
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
    }
    return btoa(binary);
  }

  function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return bytes.buffer;
  }

  function stringifySettings(includeImages: boolean): string {
    const storedImages: StoredImage[] = images.map((image) => {
      const resource = includeImages ? imageResources.get(image.key) : undefined;
      return {
        id: image.id,
        width: image.width,
        height: image.height,
        fileName: resource ? image.fileName : '',
        sourceWidth: resource ? image.sourceWidth : 0,
        sourceHeight: resource ? image.sourceHeight : 0,
        ...(resource ? { mimeType: resource.mimeType, dataBase64: arrayBufferToBase64(resource.data) } : {}),
      };
    });

    const settings: StoredSettings = {
      format: 'credit-roll-generator',
      version: 1,
      text,
      fontGroups: fontGroups.map((group) => ({ ...group })),
      images: storedImages,
      snippets: snippets.map((snippet) => ({ ...snippet })),
      wrap,
      textAlign,
      width,
      height,
      padding,
      fps,
      backgroundColor,
      duration,
      blankStart,
      blankEnd,
      durationMode,
      volume,
      audioStart,
    };
    return JSON.stringify(settings, null, 2);
  }

  function createTransferJson(): string {
    if (audioBuffer || audioFileName || audioLoading) {
      alert('음성 파일은 저장하거나 복사할 수 없으며 현재 설정 데이터에 포함되지 않습니다.');
    }
    const hasImages = images.some((image) => imageResources.has(image.key));
    const includeImages = hasImages && confirm('이미지를 Base64로 함께 저장할까요?\n취소하면 이미지 파일 데이터는 저장하지 않습니다.');
    return stringifySettings(includeImages);
  }

  function resetImageResources() {
    for (const resource of imageResources.values()) resource.bitmap.close();
    imageResources.clear();
    imageLoadTokens.clear();
  }

  function updateNextIds() {
    const numericFontIds = fontGroups.slice(1).map((group) => Number(group.id)).filter(Number.isInteger);
    const numericImageIds = images.map((image) => Number(image.id)).filter(Number.isInteger);
    nextFontGroupId = Math.max(0, ...numericFontIds) + 1;
    nextImageId = Math.max(0, ...numericImageIds) + 1;
  }

  async function applyStoredSettings(settings: StoredSettings) {
    resetImageResources();
    nextImageKey = 1;
    audioDecodeToken++;
    audioBuffer = null;
    audioFileName = '';
    audioLoading = false;

    text = settings.text;
    fontGroups = settings.fontGroups.map((group) => ({ ...group }));
    snippets = settings.snippets.length ? settings.snippets.map((snippet) => ({ ...snippet })) : [{ search: '', replacement: '' }];
    wrap = settings.wrap;
    textAlign = settings.textAlign;
    width = settings.width;
    height = settings.height;
    padding = settings.padding;
    fps = settings.fps;
    backgroundColor = settings.backgroundColor;
    duration = settings.duration;
    blankStart = settings.blankStart;
    blankEnd = settings.blankEnd;
    durationMode = settings.durationMode;
    volume = settings.volume;
    audioStart = settings.audioStart;
    images = [];

    for (const stored of settings.images) {
      const draft: ImageAssetDraft = {
        key: `image-${nextImageKey++}`,
        id: stored.id,
        width: stored.width,
        height: stored.height,
        fileName: '',
        sourceWidth: 0,
        sourceHeight: 0,
      };
      images.push(draft);
      if (!stored.dataBase64 || !stored.mimeType) continue;
      const data = base64ToArrayBuffer(stored.dataBase64);
      const bitmap = await createImageBitmap(new Blob([data], { type: stored.mimeType }));
      imageResources.set(draft.key, { data, mimeType: stored.mimeType, bitmap });
      Object.assign(draft, {
        fileName: stored.fileName,
        sourceWidth: bitmap.width,
        sourceHeight: bitmap.height,
      });
    }

    updateNextIds();
    error = '';
    scheduleRebuild();
  }

  function handleSave() {
    try {
      localStorage.setItem(SETTINGS_KEY, createTransferJson());
      error = '';
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(createTransferJson());
      error = '';
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
  }

  function handlePaste(event: ClipboardEvent) {
    const raw = event.clipboardData?.getData('text/plain');
    if (!raw) return;
    const settings = parseStoredSettings(raw);
    if (!settings) return;
    event.preventDefault();
    if (!confirm('복사된 크레딧 설정을 현재 설정에 적용할까요?')) return;
    void applyStoredSettings(settings).catch((cause) => {
      error = cause instanceof Error ? cause.message : String(cause);
    });
  }

  function updateFontGroup(index: number, patch: Partial<FontGroupDraft>) {
    Object.assign(fontGroups[index], patch);
  }

  function renameFontGroup(index: number, newId: string): boolean {
    const group = fontGroups[index];
    if (!group) return false;
    try {
      validateFontGroupId(newId, fontGroups.map((item) => item.id), index);
      const oldId = group.id;
      group.id = newId;
      text = renameFontTags(text, oldId, newId);
      error = '';
      return true;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
      return false;
    }
  }

  function addFontGroup() {
    const used = new Set(fontGroups.map((group) => group.id));
    while (used.has(String(nextFontGroupId))) nextFontGroupId++;
    fontGroups.push({
      id: String(nextFontGroupId++),
      fontUrl: '',
      fontSize: '',
      fontWeight: '',
      lineHeight: '',
      color: '',
    });
  }

  function updateImage(index: number, patch: Partial<ImageAssetDraft>) {
    Object.assign(images[index], patch);
  }

  function renameImage(index: number, newId: string): boolean {
    const image = images[index];
    if (!image) return false;
    try {
      validateImageId(newId, images.map((item) => item.id), index);
      const oldId = image.id;
      image.id = newId;
      text = renameImageRefs(text, oldId, newId);
      error = '';
      return true;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
      return false;
    }
  }

  function addImage() {
    const used = new Set(images.map((image) => image.id));
    while (used.has(String(nextImageId))) nextImageId++;
    images.push({
      key: `image-${nextImageKey++}`,
      id: String(nextImageId++),
      width: '',
      height: '',
      fileName: '',
      sourceWidth: 0,
      sourceHeight: 0,
    });
  }

  function removeImage(index: number) {
    const image = images[index];
    if (!image) return;
    const resource = imageResources.get(image.key);
    resource?.bitmap.close();
    imageResources.delete(image.key);
    imageLoadTokens.delete(image.key);
    images.splice(index, 1);
  }

  async function selectImage(index: number, file: File | null) {
    const image = images[index];
    if (!image) return;
    const token = (imageLoadTokens.get(image.key) ?? 0) + 1;
    imageLoadTokens.set(image.key, token);

    const previous = imageResources.get(image.key);
    previous?.bitmap.close();
    imageResources.delete(image.key);
    Object.assign(image, { fileName: '', sourceWidth: 0, sourceHeight: 0 });
    if (!file) return;

    try {
      if (file.type && !file.type.startsWith('image/')) throw new Error('이미지 파일을 선택하세요.');
      const [data, bitmap] = await Promise.all([file.arrayBuffer(), createImageBitmap(file)]);
      if (imageLoadTokens.get(image.key) !== token) {
        bitmap.close();
        return;
      }
      imageResources.set(image.key, {
        data,
        mimeType: file.type || 'application/octet-stream',
        bitmap,
      });
      Object.assign(image, {
        fileName: file.name,
        sourceWidth: bitmap.width,
        sourceHeight: bitmap.height,
      });
      error = '';
    } catch (cause) {
      if (imageLoadTokens.get(image.key) !== token) return;
      error = cause instanceof Error ? cause.message : String(cause);
    }
  }

  function updateSnippet(index: number, patch: Partial<Snippet>) {
    Object.assign(snippets[index], patch);
  }

  async function selectAudio(file: File | null) {
    const token = ++audioDecodeToken;
    audioBuffer = null;
    audioFileName = '';
    audioLoading = Boolean(file);
    if (!file) return;
    try {
      const decoded = await decodeAudioFile(file);
      if (token !== audioDecodeToken) return;
      audioBuffer = decoded;
      audioFileName = file.name;
      error = '';
    } catch (cause) {
      if (token !== audioDecodeToken) return;
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      if (token === audioDecodeToken) audioLoading = false;
    }
  }

  function exportImages(): ExportImageSource[] {
    const result: ExportImageSource[] = [];
    for (const image of images) {
      const resource = imageResources.get(image.key);
      if (!resource || !image.id) continue;
      result.push({ id: image.id, mimeType: resource.mimeType, data: resource.data });
    }
    return result;
  }

  async function handleExport() {
    if (rebuildTimer) clearTimeout(rebuildTimer);
    if (!await rebuild() || !config || !layout || error) return;
    exporting = true;
    exportProgress = 0;
    exportStatus = '시작 중...';
    try {
      await exportVideo(config, layout, audioBuffer, exportImages(), {
        onProgress: ({ frame, total }) => {
          exportProgress = total > 0 ? frame / total : 0;
          exportStatus = frame === total ? exportStatus : `렌더링 중 ${frame} / ${total}`;
        },
        onStatus: (message) => exportStatus = message,
      });
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
      exportStatus = '실패';
    } finally {
      exporting = false;
    }
  }

  function handleTabKey(event: KeyboardEvent, current: Tab) {
    const index = tabs.findIndex((tab) => tab.id === current);
    let next = -1;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next < 0) return;
    event.preventDefault();
    activeTab = tabs[next].id;
    requestAnimationFrame(() => document.getElementById(`tab-${activeTab}`)?.focus());
  }

  onMount(() => {
    window.addEventListener('paste', handlePaste);
    const saved = localStorage.getItem(SETTINGS_KEY);
    const parsed = saved ? parseStoredSettings(saved) : null;
    if (parsed) {
      void applyStoredSettings(parsed).catch((cause) => {
        error = cause instanceof Error ? cause.message : String(cause);
      });
    }
    return () => window.removeEventListener('paste', handlePaste);
  });

  onDestroy(() => {
    if (rebuildTimer) clearTimeout(rebuildTimer);
    fontRegistry.dispose();
    resetImageResources();
  });
</script>

<main>
  <header class="page-header">
    <div>
      <h1>크레딧 생성기</h1>
      <p>스크롤 크레딧 MP4 생성기</p>
    </div>
    <div class="page-actions">
      <button type="button" onclick={handleSave}>저장</button>
      <button type="button" onclick={handleCopy}>복사</button>
    </div>
  </header>

  <section class="settings-tabs">
    <div class="tab-list" role="tablist" aria-label="크레딧 설정">
      {#each tabs as tab}
        <button
          type="button"
          role="tab"
          id={`tab-${tab.id}`}
          aria-controls={`panel-${tab.id}`}
          aria-selected={activeTab === tab.id}
          tabindex={activeTab === tab.id ? 0 : -1}
          onclick={() => activeTab = tab.id}
          onkeydown={(event) => handleTabKey(event, tab.id)}
        >{tab.label}</button>
      {/each}
    </div>

    <div class="tab-panels panel">
      {#if activeTab === 'typography'}
        <div id="panel-typography" role="tabpanel" aria-labelledby="tab-typography">
          <FontSettings
            groups={fontGroups}
            {wrap}
            {textAlign}
            onWrap={(value) => wrap = value}
            onTextAlign={(value) => textAlign = value}
            onUpdate={updateFontGroup}
            onRename={renameFontGroup}
            onRemove={(index) => fontGroups.splice(index, 1)}
            onAdd={addFontGroup}
          />
        </div>
      {:else if activeTab === 'images'}
        <div id="panel-images" role="tabpanel" aria-labelledby="tab-images">
          <ImageSettings
            {images}
            onUpdate={updateImage}
            onRename={renameImage}
            onRemove={removeImage}
            onAdd={addImage}
            onFile={selectImage}
          />
        </div>
      {:else if activeTab === 'snippets'}
        <div id="panel-snippets" role="tabpanel" aria-labelledby="tab-snippets">
          <SnippetSettings
            {snippets}
            onUpdate={updateSnippet}
            onRemove={(index) => snippets.length > 1 && snippets.splice(index, 1)}
            onAdd={() => snippets.push({ search: '', replacement: '' })}
          />
        </div>
      {:else if activeTab === 'canvas'}
        <div id="panel-canvas" role="tabpanel" aria-labelledby="tab-canvas">
          <CanvasSettings
            {width}
            {height}
            {padding}
            {fps}
            {backgroundColor}
            onWidth={(value) => width = value}
            onHeight={(value) => height = value}
            onPadding={(value) => padding = value}
            onFps={(value) => fps = value}
            onBackgroundColor={(value) => backgroundColor = value}
          />
        </div>
      {:else if activeTab === 'timing'}
        <div id="panel-timing" role="tabpanel" aria-labelledby="tab-timing">
          <TimingSettings
            {duration}
            {blankStart}
            {blankEnd}
            onDuration={(value) => duration = value}
            onBlankStart={(value) => blankStart = value}
            onBlankEnd={(value) => blankEnd = value}
          />
        </div>
      {:else}
        <div id="panel-audio" role="tabpanel" aria-labelledby="tab-audio">
          <AudioSettings
            {durationMode}
            {volume}
            {audioStart}
            {audioInfo}
            onDurationMode={(value) => durationMode = value}
            onVolume={(value) => volume = value}
            onAudioStart={(value) => audioStart = value}
            onFile={selectAudio}
          />
        </div>
      {/if}
    </div>
  </section>

  <CreditEditor value={text} {groupIds} onchange={(value) => text = value} />

  <section class="output-panel">
    <div class="preview-meta"><p>{info}</p></div>
    <p id="error" role="alert">{error}</p>
    <Preview {config} {layout} imageSources={previewImages} />
    <div class="export-row">
      <button type="button" class="primary" disabled={exporting} onclick={handleExport}>MP4 내보내기</button>
      <progress max="1" value={exportProgress}></progress>
      <span>{exportStatus}</span>
    </div>
  </section>
</main>
