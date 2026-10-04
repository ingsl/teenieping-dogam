#!/usr/bin/env node
// 이미지 후처리: (assets/images/* 수동 | cache/images/* 자동) → public/images/<id>.webp (+ thumb/, og/)
// 사람이 넣은 assets/images/<id>.(png|jpg|webp) 가 자동 수집본보다 우선한다.
//
//   node tools/process-images.mjs           증분 (산출물이 원본보다 새로우면 스킵)
//   node tools/process-images.mjs --force
//
// - 투명 배경 PNG를 유지한 채 여백(trim)을 정리하고 webp로 변환
// - 본 이미지 최대 640px, 썸네일 240px, 공유용 OG 1200x630 PNG
// - sharp 미설치 시 안내 후 종료 (npm install 로 설치됨)

import path from 'node:path';
import { mkdir, stat, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { ROOT, PUBLIC, RAW_IMAGES, CACHE_FANDOM, args, readJson } from './lib/common.mjs';

const MANUAL = path.join(ROOT, 'assets', 'images');

const FORCE = args.has('--force');
const OUT = path.join(PUBLIC, 'images');
const SIZES = { main: 640, thumb: 240 };

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('✖ sharp 가 없습니다. `npm install` 후 다시 실행하세요.');
  process.exit(1);
}

const newer = async (out, src) => existsSync(out) && (await stat(out)).mtimeMs >= (await stat(src)).mtimeMs;

async function processOne(id, src) {
  const main = path.join(OUT, `${id}.webp`);
  const thumb = path.join(OUT, 'thumb', `${id}.webp`);
  const og = path.join(OUT, 'og', `${id}.png`);
  if (!FORCE && (await newer(main, src)) && (await newer(thumb, src)) && (await newer(og, src))) return false;

  // 가장자리 여백 제거 → 정사각 캔버스 중앙 배치(투명)
  const trimmed = await sharp(src).ensureAlpha().trim({ threshold: 5 }).toBuffer();
  const fit = (size) =>
    sharp(trimmed)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, withoutEnlargement: false })
      .webp({ quality: 82, alphaQuality: 90 });

  await fit(SIZES.main).toFile(main);
  await fit(SIZES.thumb).toFile(thumb);

  const rec = await readJson(path.join(CACHE_FANDOM, `${id}.json`));
  const bg = rec?.colorHex || '#FFC6DD';
  const character = await sharp(trimmed).resize(560, 560, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await sharp({ create: { width: 1200, height: 630, channels: 4, background: '#FFF5FA' } })
    .composite([
      { input: Buffer.from(`<svg width="1200" height="630"><circle cx="600" cy="315" r="290" fill="${bg}" fill-opacity="0.35"/></svg>`) },
      { input: character, left: 320, top: 35 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(og);
  return true;
}

async function main() {
  await Promise.all(['', 'thumb', 'og'].map((d) => mkdir(path.join(OUT, d), { recursive: true })));
  const sources = {};
  const manifest = (await readJson(path.join(RAW_IMAGES, 'manifest.json'))) || {};
  for (const [id, { file }] of Object.entries(manifest)) sources[id] = path.join(RAW_IMAGES, file);
  if (existsSync(MANUAL)) {
    for (const f of await readdir(MANUAL)) {
      const m = f.match(/^([\w-]+)\.(png|jpe?g|webp)$/i);
      if (m) sources[m[1].toLowerCase()] = path.join(MANUAL, f);
    }
  }
  let made = 0, skipped = 0, failed = 0;
  for (const [id, src] of Object.entries(sources)) {
    try {
      (await processOne(id, src)) ? made++ : skipped++;
    } catch (e) {
      failed++;
      console.warn(`  ✖ ${id}: ${e.message}`);
    }
  }
  console.log(`✔ 이미지 처리: 생성 ${made}, 스킵 ${skipped}, 실패 ${failed}`);
}

main();
