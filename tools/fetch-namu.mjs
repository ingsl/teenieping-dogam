#!/usr/bin/env node
// 보조 수집 (옵션) — 나무위키 문서에서 한 줄 소개 후보와 대표 이미지 후보를 모은다.
//
//   node tools/fetch-namu.mjs --ids=heartsping,lalaping
//
// ※ 나무위키 텍스트는 CC BY-NC-SA 2.0 KR (비영리·출처표시·동일조건). 이걸 쓰면 사이트 전체를 비영리로 유지해야 한다.
// ※ 캐릭터 이름·이미지는 SAMG엔터테인먼트 IP. 개인·비영리 팬 페이지 용도로만 사용.
// ※ API가 없으므로 HTML을 저빈도(요청 간 3초)로 가져온다. 봇 차단(challenge)이 오면 우회하지 않고 중단한다.
// ※ 값을 자동으로 합치지 않는다. cache/extra/<id>.json 의 sources[] 에 나란히 저장하고,
//   사람이 고른 값만 같은 파일의 "selected" 에 적으면 build-data가 반영한다.
//     { "sources": [...], "selected": { "intro": "..." , "source": { "namuUrl": "..." } } }

import path from 'node:path';
import { CACHE_AUX, CACHE_FANDOM, argValue, readJson, writeJson, sleep } from './lib/common.mjs';

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const ids = (argValue('ids', '') || '').split(',').map((s) => s.trim()).filter(Boolean);

const meta = (html, prop) =>
  html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, 'i'))?.[1] || '';

async function main() {
  if (!ids.length) {
    console.log('사용법: node tools/fetch-namu.mjs --ids=<id>,<id>   (빈 필드가 있는 캐릭터만 골라서 실행 권장)');
    return;
  }
  for (const id of ids) {
    const f = await readJson(path.join(CACHE_FANDOM, `${id}.json`));
    const title = f?.nameKo;
    if (!title) { console.warn(`  - ${id}: 한글명을 몰라 건너뜀 (Fandom 캐시 없음)`); continue; }
    const url = `https://namu.wiki/w/${encodeURIComponent(title)}`;
    const res = await fetch(url, { headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'ko' } });
    if (res.headers.get('cf-mitigated') === 'challenge' || res.status === 403) {
      console.warn('✖ 봇 확인(challenge)/차단 응답 — 우회하지 않고 중단합니다. 필요한 값은 overrides.json에 직접 입력하세요.');
      break;
    }
    if (!res.ok) { console.warn(`  ✖ ${id}: HTTP ${res.status}`); await sleep(3000); continue; }
    const html = await res.text();
    // 지연 로딩 이미지는 src가 아니라 data-src 에 실제 주소가 있다. 여러 캐릭터가 함께 있는 그림인지 사람이 확인할 것.
    const images = [...html.matchAll(/data-src=["'](\/\/i\.namu\.wiki\/[^"']+)["']/g)].map((m) => `https:${m[1]}`).slice(0, 5);
    const entry = {
      source: 'namu',
      url,
      license: 'CC BY-NC-SA 2.0 KR',
      fetchedAt: new Date().toISOString(),
      description: meta(html, 'og:description') || meta(html, 'description'),
      imageCandidates: images,
    };
    const file = path.join(CACHE_AUX, `${id}.json`);
    const prev = (await readJson(file)) || { id, sources: [] };
    prev.sources = [...prev.sources.filter((s) => s.source !== 'namu'), entry];
    await writeJson(file, prev);
    console.log(`  ✓ ${id} (${title}) 후보 저장 — selected 는 사람이 채움`);
    await sleep(3000);
  }
}

main().catch((e) => { console.error('✖', e.message); process.exit(1); });
