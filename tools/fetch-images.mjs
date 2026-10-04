#!/usr/bin/env node
// 대표 이미지 다운로드 (핫링크 금지 → 로컬 보관)
//
//   node tools/fetch-images.mjs           증분 (같은 원본 URL이면 스킵)
//   node tools/fetch-images.mjs --force
//
// 우선순위: Fandom 대표 이미지 → 보조 소스(cache/extra/<id>.json 의 selected.imageUrl — 사람이 고른 것)
// 결과: cache/images/<id>.<ext> + cache/images/manifest.json
//
// ※ 이미지 CDN이 봇 차단(Cloudflare challenge)을 걸면 우회하지 않고 즉시 중단한다.
//   그 경우 이미지는 사람이 직접 assets/images/<id>.png 로 넣는다 (process-images가 우선 사용).
// 이미지 저작권은 SAMG엔터테인먼트. 개인·비영리 팬 페이지 용도로만 사용한다.

import path from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { CACHE_FANDOM, CACHE_AUX, RAW_IMAGES, USER_AGENT, args, sleep, readJson, readJsonDir, writeJson } from './lib/common.mjs';

const FORCE = args.has('--force');
const MANIFEST = path.join(RAW_IMAGES, 'manifest.json');
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

async function main() {
  await mkdir(RAW_IMAGES, { recursive: true });
  const manifest = (await readJson(MANIFEST)) || {};
  const records = (await readJsonDir(CACHE_FANDOM)).filter((r) => !r.isGroup);

  let done = 0, skipped = 0, failed = 0;
  for (const rec of records) {
    const aux = await readJson(path.join(CACHE_AUX, `${rec.id}.json`));
    const url = rec.imageUrl || aux?.selected?.imageUrl;
    if (!url) continue;
    const prev = manifest[rec.id];
    if (!FORCE && prev?.url === url && existsSync(path.join(RAW_IMAGES, prev.file))) { skipped++; continue; }
    try {
      const res = await fetch(url.startsWith('//') ? `https:${url}` : url, { headers: { 'User-Agent': USER_AGENT } });
      if (res.headers.get('cf-mitigated') === 'challenge') {
        console.warn('✖ 이미지 서버가 봇 확인(challenge)을 요구합니다. 우회하지 않고 중단합니다.');
        console.warn('  → 이미지를 직접 assets/images/<id>.png 로 넣은 뒤 `node tools/process-images.mjs` 를 실행하세요.');
        break;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await sleep(300);
      const type = (res.headers.get('content-type') || '').split(';')[0];
      const file = `${rec.id}.${EXT[type] || 'png'}`;
      await writeFile(path.join(RAW_IMAGES, file), Buffer.from(await res.arrayBuffer()));
      manifest[rec.id] = { url, file, source: rec.imageUrl ? 'fandom' : 'namu', fetchedAt: new Date().toISOString() };
      done++;
      process.stdout.write(`  ✓ ${file}\n`);
    } catch (e) {
      failed++;
      console.warn(`  ✖ ${rec.id}: ${e.message}`);
    }
  }
  await writeJson(MANIFEST, manifest);
  console.log(`✔ 이미지: 받음 ${done}, 스킵 ${skipped}, 실패 ${failed}`);
}

main().catch((e) => { console.error('✖', e.message); process.exit(1); });
