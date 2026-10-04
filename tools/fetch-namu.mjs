#!/usr/bin/env node
// 나무위키 수집 (1순위 소스) — 전체 명단 + 캐릭터별 한국어 정보·대표 이미지 주소
//
//   node tools/fetch-namu.mjs                  전체 (최근 7일 안에 받은 문서는 스킵)
//   node tools/fetch-namu.mjs --force          전체 재수집
//   node tools/fetch-namu.mjs --ids=a,b        일부만 (id 또는 한글명)
//   node tools/fetch-namu.mjs --max-age=3      스킵 기준(일)
//
// 1) 「티니핑」 문서의 기수별·등급별 분류 → cache/extra/_roster.json (명단·기수·등급의 기준)
// 2) 명단(나무위키) ∪ Fandom 명단의 각 캐릭터 문서 → cache/extra/<id>.json 의 "namu"
//    id: Fandom 문서가 있으면 그 id, 없으면 나무위키 영문 번안명, 그것도 없으면 한글 로마자
//
// ※ 나무위키 텍스트 라이선스: CC BY-NC-SA 2.0 KR (비영리·출처표시·동일조건) → 사이트 전체 비영리 유지.
// ※ 캐릭터 이름·이미지는 SAMG엔터테인먼트 IP. 개인·비영리 팬 페이지 용도로만 사용.
// ※ robots.txt 가 /w/ 를 허용함. 정직한 User-Agent + 요청 간 2초. 봇 확인(challenge)/차단 응답이 오면 우회하지 않고 중단.

import path from 'node:path';
import { CACHE_AUX, CACHE_FANDOM, USER_AGENT, args, argValue, readJson, readJsonDir, writeJson, sleep, slugify } from './lib/common.mjs';
import { toRecord, looksLikeTeenieping, parseRoster, englishName, infobox } from './lib/namu.mjs';
import { romanize } from './lib/romanize.mjs';

const FORCE = args.has('--force');
const MAX_AGE_DAYS = Number(argValue('max-age', 7));
const only = new Set((argValue('ids', '') || '').split(',').map((s) => s.trim()).filter(Boolean));
const INTERVAL = 2000;
const INDEX = path.join(CACHE_AUX, '_index.json'); // { 한글명: id } — 한번 정한 id 는 유지

class Blocked extends Error {}

async function getHtml(title) {
  const url = `https://namu.wiki/w/${encodeURIComponent(title)}`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'ko' } });
  await sleep(INTERVAL);
  if (res.headers.get('cf-mitigated') || res.status === 403 || res.status === 429) throw new Blocked(`HTTP ${res.status}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { url: res.url || url, html: await res.text() };
}

/** 캐릭터 문서: 명단 링크 → 이름 → 이름(캐치! 티니핑) 순. 다른 캐릭터 문서로 넘겨진 경우는 버림 */
async function getCharacterPage(nameKo, linked) {
  for (const title of [...new Set([linked, nameKo, `${nameKo}(캐치! 티니핑)`, `${nameKo}(티니핑)`].filter(Boolean))]) {
    const page = await getHtml(title);
    if (!page || !looksLikeTeenieping(page.html)) continue;
    const landed = decodeURIComponent(new URL(page.url).pathname.replace('/w/', ''));
    if (landed.includes(nameKo)) return page;
  }
  return null;
}

async function main() {
  // 1) 명단
  console.log('▶ 나무위키 「티니핑」 문서에서 명단 수집');
  const listPage = await getHtml('티니핑');
  const roster = parseRoster(listPage.html);
  await writeJson(path.join(CACHE_AUX, '_roster.json'), roster);
  console.log(`  명단 ${roster.length}명`);

  // 2) 대상 = 나무위키 명단 ∪ Fandom 명단
  const fandom = (await readJsonDir(CACHE_FANDOM)).filter((r) => r && !r.isGroup && r.nameKo);
  const fandomByKo = new Map(fandom.map((f) => [f.nameKo, f]));
  const index = (await readJson(INDEX)) || {};
  const taken = new Map(Object.entries(index).map(([ko, id]) => [id, ko]));
  for (const f of fandom) taken.set(f.id, f.nameKo);
  const targets = [
    ...roster.map((r) => ({ nameKo: r.nameKo, page: r.page })),
    ...fandom.filter((f) => !roster.some((r) => r.nameKo === f.nameKo)).map((f) => ({ nameKo: f.nameKo, page: null })),
  ].filter((t) => !only.size || only.has(t.nameKo) || only.has(fandomByKo.get(t.nameKo)?.id || index[t.nameKo]));

  console.log(`▶ 캐릭터 문서 ${targets.length}건`);
  let ok = 0, miss = 0, skip = 0;
  for (const t of targets) {
    const f = fandomByKo.get(t.nameKo);
    let id = f?.id || index[t.nameKo];
    const prev = id ? (await readJson(path.join(CACHE_AUX, `${id}.json`))) || {} : {};
    const age = prev.namu?.fetchedAt ? (Date.now() - Date.parse(prev.namu.fetchedAt)) / 864e5 : Infinity;
    if (!FORCE && age < MAX_AGE_DAYS) { skip++; continue; }
    try {
      const page = await getCharacterPage(t.nameKo, t.page);
      if (!page) { miss++; console.log(`  - ${t.nameKo} 문서 없음`); continue; }
      const nameEnFromBox = englishName(infobox(page.html));
      const rec = toRecord(page.html, t.nameKo, f?.nameEn || nameEnFromBox);
      if (!id) {
        // 새 캐릭터: 영문 번안명 → 로마자. 다른 캐릭터가 이미 쓰는 id 면 로마자로
        id = slugify(nameEnFromBox) || slugify(romanize(t.nameKo));
        if (taken.has(id) && taken.get(id) !== t.nameKo) id = slugify(romanize(t.nameKo));
        taken.set(id, t.nameKo);
        index[t.nameKo] = id;
      }
      const namu = { url: decodeURI(page.url), license: 'CC BY-NC-SA 2.0 KR', fetchedAt: new Date().toISOString(), nameEn: nameEnFromBox, ...rec };
      const same = prev.namu && JSON.stringify({ ...prev.namu, fetchedAt: 0 }) === JSON.stringify({ ...namu, fetchedAt: 0 });
      if (!same) await writeJson(path.join(CACHE_AUX, `${id}.json`), { ...prev, id, nameKo: t.nameKo, namu });
      ok++;
      console.log(`  ✓ ${id.padEnd(20)} ${t.nameKo}  ${rec.gender || '-'} | ${rec.emotion || '-'} | 이미지 ${rec.imageUrl ? 'O' : 'X'}${f ? '' : ' (새 캐릭터)'}${same ? ' (변경 없음)' : ''}`);
    } catch (e) {
      if (e instanceof Blocked) {
        console.warn(`✖ 나무위키가 차단/봇 확인 응답(${e.message}) — 우회하지 않고 중단합니다. 나중에 다시 실행하세요.`);
        break;
      }
      console.warn(`  ✖ ${t.nameKo}: ${e.message}`);
    }
  }
  await writeJson(INDEX, index);
  console.log(`✔ 나무위키: 수집 ${ok}, 문서 없음 ${miss}, 스킵 ${skip}`);
}

main().catch((e) => { console.error('✖', e.message); process.exit(1); });
