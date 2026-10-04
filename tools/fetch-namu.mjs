#!/usr/bin/env node
// 나무위키 수집 — 한국어 상세 정보(성별·소품·마법·좋아하는 것·첫 등장·개요)와 대표 이미지 주소
//
//   node tools/fetch-namu.mjs                  전체 (최근 7일 안에 받은 문서는 스킵)
//   node tools/fetch-namu.mjs --force          전체 재수집
//   node tools/fetch-namu.mjs --ids=a,b        일부만
//   node tools/fetch-namu.mjs --max-age=3      스킵 기준(일)
//
// 대상: cache/fandom/ 에서 한글명이 있는 캐릭터. 결과: cache/extra/<id>.json 의 "namu"
//
// ※ 나무위키 텍스트 라이선스: CC BY-NC-SA 2.0 KR (비영리·출처표시·동일조건) → 사이트 전체 비영리 유지.
// ※ 캐릭터 이름·이미지는 SAMG엔터테인먼트 IP. 개인·비영리 팬 페이지 용도로만 사용.
// ※ robots.txt 가 /w/ 를 허용함. 정직한 User-Agent + 요청 간 2초. 봇 확인(challenge)/차단 응답이 오면 우회하지 않고 중단.

import path from 'node:path';
import { CACHE_AUX, USER_AGENT, args, argValue, readJson, readJsonDir, writeJson, sleep } from './lib/common.mjs';
import { CACHE_FANDOM } from './lib/common.mjs';
import { toRecord, looksLikeTeenieping } from './lib/namu.mjs';

const FORCE = args.has('--force');
const MAX_AGE_DAYS = Number(argValue('max-age', 7));
const only = new Set((argValue('ids', '') || '').split(',').map((s) => s.trim()).filter(Boolean));
const INTERVAL = 2000;

class Blocked extends Error {}

async function getPage(title) {
  const url = `https://namu.wiki/w/${encodeURIComponent(title)}`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'ko' } });
  await sleep(INTERVAL);
  if (res.headers.get('cf-mitigated') || res.status === 403 || res.status === 429) throw new Blocked(`HTTP ${res.status}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  return looksLikeTeenieping(html) ? { url: res.url || url, html } : null;
}

async function main() {
  const fandom = (await readJsonDir(CACHE_FANDOM)).filter((r) => r && !r.isGroup && r.nameKo && (!only.size || only.has(r.id)));
  console.log(`▶ 나무위키 수집 대상 ${fandom.length}건`);
  let ok = 0, miss = 0, skip = 0;
  for (const f of fandom) {
    const file = path.join(CACHE_AUX, `${f.id}.json`);
    const prev = (await readJson(file)) || { id: f.id };
    const age = prev.namu?.fetchedAt ? (Date.now() - Date.parse(prev.namu.fetchedAt)) / 864e5 : Infinity;
    if (!FORCE && age < MAX_AGE_DAYS) { skip++; continue; }
    try {
      let page = null;
      for (const title of [f.nameKo, `${f.nameKo}(캐치! 티니핑)`, `${f.nameKo}(티니핑)`]) {
        page = await getPage(title);
        // 다른 캐릭터 문서로 넘겨진 경우(예: 코러스핑 → 트롯핑)는 이 캐릭터 문서가 아니다
        const landed = decodeURIComponent(new URL(page?.url || 'https://x/').pathname.replace('/w/', ''));
        if (page && !landed.includes(f.nameKo)) page = null;
        if (page) break;
      }
      if (!page) { miss++; console.log(`  - ${f.id} (${f.nameKo}) 문서 없음`); continue; }
      const rec = toRecord(page.html, f.nameKo, f.nameEn);
      const namu = { url: decodeURI(page.url), license: 'CC BY-NC-SA 2.0 KR', fetchedAt: new Date().toISOString(), ...rec };
      // 내용이 그대로면 fetchedAt 외엔 바꾸지 않는다 (불필요한 커밋 방지)
      const same = prev.namu && JSON.stringify({ ...prev.namu, fetchedAt: 0 }) === JSON.stringify({ ...namu, fetchedAt: 0 });
      if (!same) await writeJson(file, { ...prev, namu });
      ok++;
      console.log(`  ✓ ${f.id.padEnd(20)} ${f.nameKo}  ${rec.gender || '-'} | ${rec.emotion || '-'} | 이미지 ${rec.imageUrl ? 'O' : 'X'}${same ? ' (변경 없음)' : ''}`);
    } catch (e) {
      if (e instanceof Blocked) {
        console.warn(`✖ 나무위키가 차단/봇 확인 응답(${e.message}) — 우회하지 않고 중단합니다. 나중에 다시 실행하세요.`);
        break;
      }
      console.warn(`  ✖ ${f.id}: ${e.message}`);
    }
  }
  console.log(`✔ 나무위키: 수집 ${ok}, 문서 없음 ${miss}, 스킵 ${skip}`);
}

main().catch((e) => { console.error('✖', e.message); process.exit(1); });
