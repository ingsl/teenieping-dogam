#!/usr/bin/env node
// 배경 제거: 투명 배경이 아닌 원본(극장판 포스터·흰 배경 등)에서 캐릭터만 잘라낸다.
//
//   node tools/remove-bg.mjs            배경 있는 원본 중 아직 안 자른 것만
//   node tools/remove-bg.mjs --force    다시 자르기
//   node tools/remove-bg.mjs --ids=a,b
//
// 입력: cache/images/<id>.* (fetch-images 결과) / 결과: cache/cutout/<id>.png → process-images 가 우선 사용
// AI 모델: @imgly/background-removal-node (로컬 실행, 외부 전송 없음, 선택 의존성)
// ※ 이 스크립트는 sharp 를 불러오지 않는다 (라이브러리 내부 sharp 와 버전이 달라 한 프로세스에서 충돌).
//   그래서 "배경이 있는지" 판정은 process-images 가 cache/cutout/needs.json 으로 넘겨준다.

import path from 'node:path';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { ROOT, RAW_IMAGES, args, argValue, readJson } from './lib/common.mjs';

const CUTOUT = path.join(ROOT, 'cache', 'cutout');
const FORCE = args.has('--force');
const only = (argValue('ids', '') || '').split(',').filter(Boolean);

let removeBackground;
try {
  ({ removeBackground } = await import('@imgly/background-removal-node'));
} catch {
  console.warn('! @imgly/background-removal-node 가 없어 배경 제거를 건너뜁니다 (npm install 로 설치).');
  process.exit(0);
}

const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };

async function main() {
  await mkdir(CUTOUT, { recursive: true });
  const manifest = (await readJson(path.join(ROOT, 'cache', 'images-manifest.json'))) || {};
  const needs = only.length ? only : (await readJson(path.join(CUTOUT, 'needs.json'))) || [];
  let made = 0;
  for (const id of needs) {
    const file = manifest[id]?.file;
    const src = file && path.join(RAW_IMAGES, file);
    const out = path.join(CUTOUT, `${id}.png`);
    if (!src || !existsSync(src)) continue;
    // 원본이 바뀌었으면(원본이 더 새로우면) 다시 자른다
    if (!FORCE && existsSync(out) && (await stat(out)).mtimeMs >= (await stat(src)).mtimeMs) continue;
    const ext = path.extname(src).slice(1).toLowerCase();
    const blob = new Blob([await readFile(src)], { type: MIME[ext] || 'image/png' });
    const result = await removeBackground(blob, { model: 'medium', output: { format: 'image/png' } });
    await writeFile(out, Buffer.from(await result.arrayBuffer()));
    made++;
    console.log(`  ✓ ${id} 배경 제거`);
  }
  console.log(`✔ 배경 제거 ${made}건 (대상 ${needs.length})`);
}

main().catch((e) => { console.error('✖', e.message); process.exit(1); });
