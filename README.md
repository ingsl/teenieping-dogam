# 티니핑 도감 (비공식 팬 사이트)

'캐치! 티니핑' 캐릭터 도감 + 메모리 게임 + 퍼즐 게임. 순수 HTML/CSS/JS 정적 사이트로 GitHub Pages에 배포하고,
수집·빌드 파이프라인도 전부 Node.js(ES 모듈)로 작성했습니다.

> **비공식·비영리 팬 페이지**입니다. 캐릭터 이름·이미지 등 모든 권리는 **SAMG엔터테인먼트**에 있습니다.
> 광고·후원·판매 등 수익화를 하지 않습니다. 캐릭터 정보 일부는 [Catch! Teenieping Wiki (Fandom)](https://catchteenieping.fandom.com/) — CC BY-SA 3.0.

## 빠른 시작

```bash
npm install          # sharp(이미지 변환) 설치
npm run build        # 데이터 조립 + 상세 페이지 생성
npm run dev          # http://localhost:5173
```

## 구조

```
public/                  ← GitHub Pages로 배포되는 정적 사이트 (이 폴더만 올라감)
  index.html             도감 목록 (검색·필터)
  games/                 게임 메뉴 · memory.html · puzzle.html
  css/style.css
  js/                    ES 모듈 (data.js 공용, dogam/detail/memory/puzzle/random/config)
  images/                ★ 생성물: <id>.webp, thumb/, og/
  data/teeniepings.json  ★ 생성물 (직접 수정 금지)
  data/ping-ids.json     ★ 생성물
  p/<id>.html            ★ 생성물: 캐릭터 상세 페이지
src/                     ← 사람이 고치는 소스
  roster.js              공식 도감 전사 명단 (정본: 이름·기수·등급)
  overrides.json         수동 보정 (모든 소스를 이김, 재수집해도 유지)
  seasons.js             기수 정의 · Fandom 분류 매핑
assets/images/           ← 사람이 직접 넣는 캐릭터 이미지 (<id>.png), 자동 수집본보다 우선
cache/fandom/            Fandom API 수집 캐시 (문서별 JSON, revid 증분)
cache/extra/               보조 소스 후보(나무위키 등) — 사람이 selected 에 고른 값만 반영
tools/                   수집·빌드 스크립트 (Node)
worker/                  Cloudflare Worker (좋아요/랭크, 선택)
.github/workflows/       update.yml(주 1회 수집) · deploy.yml(Pages 배포)
```

## 데이터 파이프라인

| 단계 | 명령 | 설명 |
|---|---|---|
| 수집 | `npm run fetch` | Fandom API `Category:Teeniepings` → `cache/fandom/`. revid 같으면 스킵, `-- --force` 전량, `-- --limit=10` 시범 |
| 이미지 | `npm run images` | 대표 이미지 다운로드 → webp(640) / 썸네일(240) / OG(1200×630) |
| 보조 | `npm run fetch:namu -- --ids=a,b` | (옵션) 나무위키 후보 수집. 자동 병합 안 함 |
| 빌드 | `npm run build` | roster + 캐시 + 보조 selected + overrides 병합 → JSON + 상세 페이지, 빈 필드 리포트 출력 |

**병합 우선순위** (아래가 이김): Fandom 캐시 → 보조 `selected` → `roster` (이름·기수·등급) → `overrides.json`

- `roster.js`에 있는 캐릭터는 "검증됨", Fandom에만 있는 캐릭터는 **미검증** 배지로 표시됩니다.
  `npm run build:data -- --strict` 로 빌드하면 roster에 있는 캐릭터만 나옵니다.
- 값을 지어내지 않습니다. 소스에 없으면 비워 두고, 빌드 리포트를 보고 `overrides.json`으로 채웁니다.

### 해야 할 일 (사람)

1. **`src/roster.js` 채우기** — 공식 도감을 보고 직접 전사. (현재 형식 예시 3건뿐)
   다른 저장소(예: elsewon/TeeniepingCompendium)의 명단을 복사하지 마세요.
2. **이미지** — Fandom 이미지 CDN이 봇 확인(Cloudflare challenge)을 요구해서 자동 다운로드가 막혀 있습니다.
   스크립트는 우회하지 않고 멈춥니다. 이미지는 `assets/images/<id>.png`(투명 배경 권장)로 직접 넣고
   `node tools/process-images.mjs && npm run build` 하세요. 이미지가 없으면 대표색 플레이스홀더로 표시됩니다.
3. **한국어 보정** — 감정·소품·마법 일부는 영문 위키 원문입니다. `overrides.json`에서 한국어로 덮어쓰세요.

```jsonc
// src/overrides.json
{ "heartsping": { "emotion": "사랑", "item": "손거울", "intro": "..." } }
```

## 게임

- **메모리 게임** (`games/memory.html`): 3×4 · 4×4 · 5×5(가운데 보너스 칸) · 6×6 · 8×8. 기수별 카드 선택, 이동 수·시간·별점, 최고 기록(브라우저 저장).
- **퍼즐 게임** (`games/puzzle.html`): 바꾸기(두 조각 교환, 어린이용) / 슬라이드(15퍼즐식) × 쉬움 3×3 · 보통 4×4 · 어려움 5×5 · 고수 6×6.
  캐릭터 선택 또는 내 사진 업로드(기기 밖으로 전송 안 됨), 번호 힌트, 정답 미리보기, 키보드 화살표 지원.
  슬라이드는 완성 상태에서 빈칸을 무작위로 움직여 섞기 때문에 항상 풀 수 있습니다.

## 배포

1. GitHub 저장소 → Settings → Pages → Source: **GitHub Actions**
2. `main`에 push하면 `deploy.yml`이 `public/`을 배포합니다.
3. `update.yml`이 매주 월요일 03:00(KST) Fandom을 증분 수집해 변경분만 커밋 → 배포가 이어서 실행됩니다. Actions 탭에서 수동 실행도 가능.

### 좋아요 (선택)

```bash
cd worker
npx wrangler kv namespace create LIKES   # 출력된 id를 wrangler.toml에
npx wrangler deploy
```
`wrangler.toml`의 `ALLOWED_ORIGINS`에 사이트 주소, `public/js/config.js`의 `counterUrl`에 Worker 주소를 넣으면 상세 페이지에 좋아요 버튼이 나타납니다.

## 라이선스 메모

- 캐릭터 이름·이미지: SAMG엔터테인먼트 IP → 비영리 팬 페이지 + 권리 고지 유지
- Fandom 텍스트: CC BY-SA 3.0 → 출처 링크(각 상세 페이지 하단) + 동일조건
- 나무위키 텍스트를 쓰는 경우: CC BY-NC-SA 2.0 KR → **비영리** 필수
