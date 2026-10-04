# 티니핑 도감 (비공식 팬 사이트)

'캐치! 티니핑' 캐릭터 도감 + 메모리 게임 + 퍼즐 게임. **React + Vite + React Router** 로 만든 SPA를 GitHub Pages에 배포하고,
수집·빌드 파이프라인은 Node.js(ES 모듈)로 작성했습니다. 주소는 `/p/heartsping`, `/games/memory` 처럼 깔끔한 경로입니다.

> **비공식·비영리 팬 페이지**입니다. 캐릭터 이름·이미지 등 모든 권리는 **SAMG엔터테인먼트**에 있습니다.
> 광고·후원·판매 등 수익화를 하지 않습니다. 캐릭터 정보 출처: [나무위키](https://namu.wiki/) (CC BY-NC-SA 2.0 KR), [Catch! Teenieping Wiki (Fandom)](https://catchteenieping.fandom.com/) (CC BY-SA 3.0).

## 빠른 시작

```bash
npm install          # React·Vite + sharp(이미지 변환) + 배경 제거 모델
npm run dev          # http://localhost:5173 (Vite 개발 서버)
npm run build        # 데이터 조립 → vite build → 주소별 index.html 생성 (dist/)
```

## 구조

```
index.html               Vite 진입점
src/                     ← React 앱
  main.jsx · App.jsx     라우터 (/, /p/:id, /games, /games/memory, /games/puzzle)
  pages/                 Dogam · Detail · Games · Memory · Puzzle · NotFound
  components/            Layout(헤더·푸터) · CharacterCard(도감 카드 = 메모리 카드 앞면) · ResultDialog
  lib/data.js            데이터 훅(useData)·검색(초성)·타이머·저장소 유틸
  styles.css · config.js
public/                  ← 정적 파일 (빌드 때 그대로 복사)
  data/teeniepings.json  ★ 생성물 (직접 수정 금지)
  images/                ★ 생성물: <id>.webp, thumb/, og/
content/                 ← 데이터 설정·보정 (선택)
  seasons.js             기수 정의 · Fandom 분류 · 첫 등장 문구 매핑
  roster.js              (선택) 사람이 확정한 이름·기수·등급
  overrides.json         (선택) 값 보정, 모든 소스를 이김. { "<id>": { "keep": true } } 로 제외 예외
assets/images/           (선택) 직접 넣는 캐릭터 이미지 <id>.png — 자동 수집본보다 우선
cache/fandom/            Fandom API 수집 캐시
cache/extra/             나무위키 수집 캐시 (aux 는 Windows 예약어라 extra)
cache/cutout/            배경 제거본 (극장판 포스터·흰 배경 원본)
tools/                   수집·빌드 스크립트 (Node)
worker/                  Cloudflare Worker (좋아요/랭크, 선택)
.github/workflows/       update.yml(주 1회 수집) · deploy.yml(Pages 배포)
```

## 데이터 파이프라인 (전부 자동)

| 단계 | 명령 | 설명 |
|---|---|---|
| 명단·상세 (1순위) | `npm run fetch:namu` | 나무위키 「티니핑」 문서의 기수별·등급별 분류 → 명단 (`cache/extra/_roster.json`), 캐릭터 문서 → 성별·감정·소품·마법·좋아하는 것·첫 등장·소개·이미지 주소. 7일 지난 문서만 다시 받음 |
| 보충 (2순위) | `npm run fetch` | Fandom API `Category:Teeniepings` → `cache/fandom/`. 나무위키에 없는 캐릭터·값만 보충 (영문명·대표색·관계 등). revid 증분 |
| 이미지 | `npm run images` | 나무위키(인포박스 첫 사진 = 기본 모습) → 없으면 Fandom 순으로 받기 → 배경 있는 원본은 자동 배경 제거(`tools/remove-bg.mjs`) → webp(640) / 썸네일(240) / OG(1200×630) |
| 빌드 | `npm run build` | 병합 → `public/data/teeniepings.json` (이미지 없거나 미확인인 항목 제외) → `vite build` → `tools/prerender.mjs` 가 주소별 `index.html`(캐릭터별 OG) + `404.html` 생성 |

한 번에: `npm run update` (Fandom → 나무위키 → 이미지 → 빌드)

**우선순위**: `overrides.json` > `roster.js` > **나무위키** > Fandom. 나무위키·Fandom 어디에도 정보가 없거나 이미지가 없으면 도감에서 뺍니다.

- 화면에는 **한국어만** 나옵니다. Fandom 영문 설명은 쓰지 않고 영문명만 씁니다.
- 기수: Fandom 분류로 정하고, 못 정하면 나무위키 "첫 등장" 문구(예: `쥬얼스타 캐치! 티니핑 1화`)로 정합니다. 설정은 `content/seasons.js`.
- 명단은 나무위키 ∪ Fandom 합집합입니다. 나무위키에만 있는 새 캐릭터의 id 는 나무위키 영문 번안명, 없으면 한글 로마자로 만듭니다(`cache/extra/_index.json` 에 고정).
- `roster.js` / `overrides.json` 은 **손댈 필요 없습니다.** 자동 수집 값이 틀렸을 때만 쓰는 비상용입니다.
- 이미지 서버가 봇 확인(Cloudflare challenge)을 요구하면 우회하지 않고 다음 후보로 넘어갑니다. (현재 Fandom CDN이 그 상태라 나무위키 이미지를 씁니다.)

```jsonc
// content/overrides.json — 필요할 때만
{ "heartsping": { "emotion": "사랑" } }
```

## 게임

| 게임 | 주소 | 내용 |
|---|---|---|
| 누구일까? | `/games/quiz` | 사진·그림자·확대 사진 보고 이름 맞히기. 전체/기수별, 쉬움(3지선다)·보통(4지선다 12초)·어려움(6초), 10문제 |
| 그림자 찾기 | `/games/shadow` | 티니핑을 보고 그림자 5개 중 같은 모양 찾기, 10문제 |
| 티니핑을 캐치! | `/games/catch` | 9개 구멍에서 나오는 티니핑 중 찾는 티니핑만 콕 (30초, 천천히/보통/빠르게) |
| 티니핑 팡팡 | `/games/pang` | 7×7 같은 티니핑 3개 맞추기(연쇄 콤보), 60초, 쉬움 4종·보통 5종·어려움 6종, 힌트·밀기 지원 |
| 메모리 게임 | `/games/memory` | 3×4 ~ 8×8, 카드 앞면 = 도감 카드 |
| 퍼즐 | `/games/puzzle` | 바꾸기/슬라이드 × 3×3 ~ 6×6, 스와이프 지원 |

- 효과음은 Web Audio 로 만든 실로폰·종소리(파일 없음). 퍼즐 이동 "스윽", 메모리 짝 맞음/틀림, 클리어 팡파르.
- **목소리**: 브라우저 기계음(TTS)은 쓰지 않습니다. 사람 목소리 녹음을 `public/voice/` 에 넣으면 재생됩니다:
  `start.mp3`(시작) · `correct.mp3`(정답) · `wrong.mp3`(오답) · `win.mp3`(완료)
- 안내 문구의 조사(이/가, 을/를, 이에요/예요…)는 `src/lib/korean.js` 의 `josa()` 로 받침에 맞게 자동 선택.

## 배포

1. GitHub 저장소 → Settings → Pages → Source: **GitHub Actions**
2. `main`에 push하면 `deploy.yml`이 `BASE_PATH=/<저장소명>/` 로 빌드해 `dist/`를 배포합니다.
3. `update.yml`이 매주 월요일 03:00(KST) Fandom·나무위키·이미지를 증분 수집해 변경분만 커밋 → 배포가 이어서 실행됩니다. Actions 탭에서 수동 실행도 가능.

### 좋아요 (선택)

```bash
cd worker
npx wrangler kv namespace create LIKES   # 출력된 id를 wrangler.toml에
npx wrangler deploy
```
`wrangler.toml`의 `ALLOWED_ORIGINS`에 사이트 주소, `src/config.js`의 `counterUrl`에 Worker 주소를 넣으면 상세 페이지에 좋아요 버튼이 나타납니다.

## 라이선스 메모

- 캐릭터 이름·이미지: SAMG엔터테인먼트 IP → 비영리 팬 페이지 + 권리 고지 유지
- Fandom 텍스트: CC BY-SA 3.0 → 출처 링크(각 상세 페이지 하단) + 동일조건
- 나무위키 텍스트를 쓰는 경우: CC BY-NC-SA 2.0 KR → **비영리** 필수
