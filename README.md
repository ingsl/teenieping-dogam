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
| 명단·분류 | `npm run fetch` | Fandom API `Category:Teeniepings` → `cache/fandom/`. 영문명·기수/등급 분류·대표색·관계. revid 증분, `-- --force` 전량 |
| 한국어 상세 | `npm run fetch:namu` | 나무위키 문서(한글명) → `cache/extra/`. 성별·감정·소품·마법·좋아하는 것·첫 등장·소개·이미지 주소. 7일 지난 문서만 다시 받음 |
| 이미지 | `npm run images` | Fandom → (차단 시) 나무위키 순으로 받기 → 배경 있는 원본은 자동 배경 제거(`tools/remove-bg.mjs`) → webp(640) / 썸네일(240) / OG(1200×630) |
| 빌드 | `npm run build` | 병합 → `public/data/teeniepings.json` (이미지 없거나 미확인인 항목 제외) → `vite build` → `tools/prerender.mjs` 가 주소별 `index.html`(캐릭터별 OG) + `404.html` 생성 |

한 번에: `npm run update`

**병합 우선순위** (아래가 이김): Fandom → 나무위키 → `content/roster.js`(선택) → `content/overrides.json`(선택)

- 화면에는 **한국어만** 나옵니다. Fandom 영문 설명은 쓰지 않고 영문명만 씁니다.
- 기수: Fandom 분류로 정하고, 못 정하면 나무위키 "첫 등장" 문구(예: `쥬얼스타 캐치! 티니핑 1화`)로 정합니다. 설정은 `content/seasons.js`.
- Fandom·나무위키 **양쪽에 다 있는 캐릭터는 자동으로 "확인됨"**, 한쪽에만 있으면 "미확인" 배지가 붙습니다.
- `roster.js` / `overrides.json` 은 **손댈 필요 없습니다.** 자동 수집 값이 틀렸을 때만 쓰는 비상용입니다.
- 이미지 서버가 봇 확인(Cloudflare challenge)을 요구하면 우회하지 않고 다음 후보로 넘어갑니다. (현재 Fandom CDN이 그 상태라 나무위키 이미지를 씁니다.)

```jsonc
// content/overrides.json — 필요할 때만
{ "heartsping": { "emotion": "사랑" } }
```

## 게임

- **메모리 게임** (`/games/memory`): 카드 앞면은 도감 카드와 같은 모양.: 3×4 · 4×4 · 5×5(가운데 보너스 칸) · 6×6 · 8×8. 기수별 카드 선택, 이동 수·시간·별점, 최고 기록(브라우저 저장).
- **퍼즐 게임** (`/games/puzzle`): 바꾸기(두 조각 교환, 어린이용) / 슬라이드(15퍼즐식) × 쉬움 3×3 · 보통 4×4 · 어려움 5×5 · 고수 6×6.
  캐릭터 선택 또는 내 사진 업로드(기기 밖으로 전송 안 됨), 번호 힌트, 정답 미리보기, 키보드 화살표 지원.
  슬라이드는 완성 상태에서 빈칸을 무작위로 움직여 섞기 때문에 항상 풀 수 있습니다.

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
