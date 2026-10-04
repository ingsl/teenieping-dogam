#!/usr/bin/env node
// 대표 이미지 다운로드 (핫링크 금지 → 로컬 보관)
//
//   node tools/fetch-images.mjs           증분 (같은 원본 URL이면 스킵)
//   node tools/fetch-images.mjs --force
//
// 후보 순서: Fandom 대표 이미지 → 나무위키 대표 이미지 (cache/extra/<id>.json 의 namu.imageUrl)
// 결과: cache/images/<id>.<ext> (git 제외) + cache/images-manifest.json (git 포함 → CI에서 재다운로드 방지)
//
// ※ 이미지 서버가 봇 확인(Cloudflare challenge)을 요구하면 그 서버는 우회하지 않고 이번 실행 동안 건너뛴다.
// ※ 사람이 넣은 assets/images/<id>.png 가 있으면 process-images 가 그것을 우선 사용한다.
// 이미지 저작권은 SAMG엔터테인먼트. 개인·비영리 팬 페이지 용도로만 사용한다.

import path from 'node:path';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { PUBLIC, CACHE_FANDOM, CACHE_AUX, RAW_IMAGES, USER_AGENT, args, sleep, readJson, readJsonDir, writeJson } from './lib/common.mjs';

const FORCE = args.has('--force');
const MANIFEST = path.join(RAW_IMAGES, '..', 'images-manifest.json');
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
const blockedHosts = new Set();

async function download(url) {
  const host = new URL(url).host;
  if (blockedHosts.has(host)) return null;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  await sleep(500);
  if (res.headers.get('cf-mitigated') === 'challenge') {
    blockedHosts.add(host);
    console.warn(`  ! ${host} 가 봇 확인을 요구 → 우회하지 않고 이 서버는 건너뜀`);
    return null;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = (res.headers.get('content-type') || '').split(';')[0];
  if (!EXT[type]) throw new Error(`이미지가 아님 (${type})`);
  return { buf: Buffer.from(await res.arrayBuffer()), ext: EXT[type] };
}

async function main() {
  await mkdir(RAW_IMAGES, { recursive: true });
  const manifest = (await readJson(MANIFEST)) || {};
  const records = (await readJsonDir(CACHE_FANDOM)).filter((r) => r && !r.isGroup);

  let done = 0, skipped = 0, failed = 0, none = 0;
  for (const rec of records) {
    const namu = (await readJson(path.join(CACHE_AUX, `${rec.id}.json`)))?.namu;
    const candidates = [
      rec.imageUrl && { url: rec.imageUrl, source: 'fandom' },
      namu?.imageUrl && { url: namu.imageUrl, source: 'namu' },
    ].filter(Boolean);
    const prev = manifest[rec.id];
    // 같은 원본이고, 원본 파일이나 변환된 webp 중 하나라도 있으면 스킵
    const have = prev && (existsSync(path.join(RAW_IMAGES, prev.file)) || existsSync(path.join(PUBLIC, 'images', `${rec.id}.webp`)));
    if (!FORCE && have && candidates.some((c) => c.url === prev.url)) { skipped++; continue; }

    let got = null;
    for (const c of candidates) {
      try {
        const r = await download(c.url);
        if (r) { got = { ...c, ...r }; break; }
      } catch (e) {
        console.warn(`  ✖ ${rec.id} (${c.source}): ${e.message}`);
      }
    }
    if (!got) {
      candidates.length ? failed++ : none++;
      // 예전에 받은 이미지가 더 이상 후보가 아니면(출처 문서가 바뀜) 잘못된 그림이 남지 않게 지운다
      if (prev && !candidates.some((c) => c.url === prev.url)) {
        delete manifest[rec.id];
        for (const f of [path.join(RAW_IMAGES, prev.file), ...['', 'thumb'].map((d) => path.join(PUBLIC, 'images', d, `${rec.id}.webp`)), path.join(PUBLIC, 'images', 'og', `${rec.id}.jpg`)]) await rm(f, { force: true });
        console.log(`  - ${rec.id}: 이전 이미지 제거 (후보에서 빠짐)`);
      }
      continue;
    }
    const file = `${rec.id}.${got.ext}`;
    await writeFile(path.join(RAW_IMAGES, file), got.buf);
    manifest[rec.id] = { url: got.url, file, source: got.source, fetchedAt: new Date().toISOString() };
    done++;
    console.log(`  ✓ ${file} (${got.source})`);
  }
  await writeJson(MANIFEST, manifest);
  console.log(`✔ 이미지: 받음 ${done}, 스킵 ${skipped}, 실패 ${failed}, 후보 없음 ${none}`);
}

main().catch((e) => { console.error('✖', e.message); process.exit(1); });
