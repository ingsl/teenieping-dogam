#!/usr/bin/env node
// 이미지 후처리: (assets/images/* 수동 | cache/cutout/* 배경 제거본 | cache/images/* 자동) → public/images/<id>.webp (+ thumb/, og/)
// 배경이 있는 원본은 자동 감지해 tools/remove-bg.mjs 로 캐릭터만 잘라낸다.
// 사람이 넣은 assets/images/<id>.(png|jpg|webp) 가 자동 수집본보다 우선한다.
//
//   node tools/process-images.mjs           증분 (산출물이 원본보다 새로우면 스킵)
//   node tools/process-images.mjs --force
//
// - 투명 배경 PNG를 유지한 채 여백(trim)을 정리하고 webp로 변환
// - 본 이미지 최대 640px, 썸네일 240px, 공유용 OG 1200x630 JPEG
// - sharp 미설치 시 안내 후 종료 (npm install 로 설치됨)

import path from 'node:path';
import { mkdir, stat, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { ROOT, PUBLIC, RAW_IMAGES, CACHE_FANDOM, args, readJson } from './lib/common.mjs';

const MANUAL = path.join(ROOT, 'assets', 'images');
const CUTOUT = path.join(ROOT, 'cache', 'cutout');

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

/** 투명 픽셀이 5% 이상이면 이미 배경이 없는 캐릭터 이미지로 본다 */
async function hasTransparency(src) {
  const { data, info } = await sharp(src).ensureAlpha().resize(128, 128, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
  let clear = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 20) clear++;
  return clear / (info.width * info.height) >= 0.05;
}

/** 충분히 불투명한(알파 > 96) 픽셀의 경계 상자로 자른다. 배경 제거 후 남은 희미한 물방울·그림자는 무시 */
async function cropToContent(src) {
  const img = sharp(src).ensureAlpha();
  const { data, info } = await img.clone().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 96) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return img.png().toBuffer();
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.02);
  const left = Math.max(0, x0 - pad), top = Math.max(0, y0 - pad);
  return img
    .extract({ left, top, width: Math.min(info.width - left, x1 - x0 + 1 + pad * 2), height: Math.min(info.height - top, y1 - y0 + 1 + pad * 2) })
    .png()
    .toBuffer();
}

const newer = async (out, src) => existsSync(out) && (await stat(out)).mtimeMs >= (await stat(src)).mtimeMs;

async function processOne(id, src) {
  const main = path.join(OUT, `${id}.webp`);
  const thumb = path.join(OUT, 'thumb', `${id}.webp`);
  const og = path.join(OUT, 'og', `${id}.jpg`);
  if (!FORCE && (await newer(main, src)) && (await newer(thumb, src)) && (await newer(og, src))) return false;

  // 가장자리 여백 제거 → 정사각 캔버스 중앙 배치(투명)
  const trimmed = await cropToContent(src);
  const fit = (size) =>
    sharp(trimmed)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, withoutEnlargement: false })
      .webp({ quality: 82, alphaQuality: 90 });

  await fit(SIZES.main).toFile(main);
  await fit(SIZES.thumb).toFile(thumb);

  const character = await sharp(trimmed).resize(560, 560, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await sharp({ create: { width: 1200, height: 630, channels: 4, background: '#FFF5FA' } })
    .composite([{ input: character, left: 320, top: 35 }])
    .flatten({ background: '#FFF5FA' })
    .jpeg({ quality: 80, mozjpeg: true })
    .toFile(og);
  return true;
}

async function main() {
  await Promise.all(['', 'thumb', 'og'].map((d) => mkdir(path.join(OUT, d), { recursive: true })));
  const sources = {};
  const manifest = (await readJson(path.join(RAW_IMAGES, '..', 'images-manifest.json'))) || {};
  for (const [id, { file }] of Object.entries(manifest)) {
    if (existsSync(path.join(RAW_IMAGES, file))) sources[id] = path.join(RAW_IMAGES, file);
  }
  // 배경이 있는(거의 투명 픽셀이 없는) 원본은 배경 제거본(cache/cutout)을 쓴다
  const needs = [];
  for (const [id, src] of Object.entries(sources)) if (!(await hasTransparency(src))) needs.push(id);
  await mkdir(CUTOUT, { recursive: true });
  await writeFile(path.join(CUTOUT, 'needs.json'), JSON.stringify(needs, null, 2) + '\n');
  const stale = async (id) => { const c = path.join(CUTOUT, `${id}.png`); return !existsSync(c) || (await stat(c)).mtimeMs < (await stat(sources[id])).mtimeMs; };
  if ((await Promise.all(needs.map(stale))).some(Boolean)) {
    // 배경 제거 라이브러리는 다른 버전의 sharp 를 써서 별도 프로세스로 실행
    spawnSync(process.execPath, [path.join(ROOT, 'tools', 'remove-bg.mjs')], { stdio: 'inherit' });
  }
  for (const id of needs) {
    const cut = path.join(CUTOUT, `${id}.png`);
    if (existsSync(cut)) sources[id] = cut;
  }
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
