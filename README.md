# Credit Generator

브라우저에서 스크롤 크레딧을 미리보고 H.264/AAC MP4로 내보내는 정적 웹 앱입니다.

## 개발

```bash
npm install
npm run dev
```

검증 및 빌드:

```bash
npm run check
npm test
npm run build
```

Vite의 base 경로는 `/creditGenerator/`로 고정되어 있어 빌드 결과를 현재 공개 URL인 `https://hinaple.github.io/creditGenerator/`에 그대로 배포할 수 있습니다.

## 문법

- `<id>text</id>`: 해당 글꼴 그룹으로 렌더링
- `{#width=300}`: 현재 줄에 300px 가로 공간 추가
- `{#height=20}`: 강제 개행 후 20px 세로 공간 추가
- `{#img=ID}`: 이미지 탭에 등록한 이미지를 독립된 이미지 행으로 렌더링
- `[#a]text[/a]`, `[#anchor]text[/anchor]`: 가운데 정렬에서 내부 영역의 실제 픽셀 중심을 해당 줄의 중앙 기준점으로 사용
- anchor 내부에서는 `{#width}`를 사용할 수 있지만 개행과 `{#height}`는 사용할 수 없음
- 한 source line에는 anchor를 하나만 사용할 수 있음
- 이미지 크기를 비워 두면 원본 크기를 사용하되 가용 화면 너비까지만 축소하며, 한 축만 지정하면 비율 유지, 두 축을 지정하면 강제 리사이즈

스니펫은 원본 텍스트에 위에서 아래 순서로 전역 문자열 치환된 뒤 위 문법을 파싱합니다.

## 구조

- `src/lib/core/parser.ts`: 크레딧 문법 파서
- `src/lib/core/font.ts`: 글꼴 그룹 resolve 및 브라우저 폰트 로딩
- `src/lib/core/layout.ts`: Pretext 기반 줄바꿈/레이아웃
- `src/lib/core/render.ts`: preview/export 공용 Canvas 렌더링과 visible-line 최적화
- `src/lib/export-video.ts`: 오디오 디코딩 및 export worker 호출
- `src/workers/export.worker.ts`: Mediabunny MP4 인코딩
- `src/components`: Svelte 5 UI

## 자동 배포

`.github/workflows/deploy.yml`은 `main` push 시 check/test/build 후 `dist/`를 `hinaple/hinaple.github.io` 저장소의 `creditGenerator/` 디렉터리에 교체합니다.

GitHub Actions secret `PAGES_DEPLOY_TOKEN`이 필요합니다. 이 토큰은 `hinaple/hinaple.github.io` 저장소에 대한 `Contents: Read and write` 권한만 가진 fine-grained PAT으로 설정하는 것을 권장합니다.
