#!/usr/bin/env node
// vite build 뒤처리 — GitHub Pages 에서 깔끔한 주소(/p/heartsping)가 새로고침·공유에도 동작하도록
// 주소마다 dist/<경로>/index.html 을 만들고, 캐릭터별 제목·설명·OG 이미지를 넣는다.
// 그 밖의 주소는 404.html(= 앱)로 떨어져 React Router 가 처리한다.
//
// 사이트 절대 주소(OG 이미지용): SITE_URL 환경변수. 예) https://ingsl.github.io/teenieping-dogam/

import path from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { ROOT, readJson } from './lib/common.mjs';

const DIST = path.join(ROOT, 'dist');
const SITE_URL = process.env.SITE_URL ? process.env.SITE_URL.replace(/\/?$/, '/') : '';
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function page(template, { title, description, ogImage }) {
  let html = template
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(description)}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(title)}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(description)}$2`);
  if (ogImage && SITE_URL) {
    html = html.replace('<!--og:image-->', `<meta property="og:image" content="${esc(SITE_URL + ogImage)}" />\n    <meta name="twitter:card" content="summary_large_image" />`);
  }
  return html;
}

async function emit(route, html) {
  const dir = path.join(DIST, route);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'index.html'), html, 'utf8');
}

async function main() {
  const template = await readFile(path.join(DIST, 'index.html'), 'utf8');
  const data = await readJson(path.join(DIST, 'data', 'teeniepings.json'));
  await writeFile(path.join(DIST, '404.html'), template, 'utf8');
  await writeFile(path.join(DIST, '.nojekyll'), '', 'utf8');

  const statics = [
    ['games', '티니핑 게임', '누구일까? · 그림자 찾기 · 티니핑을 캐치! · 티니핑 팡팡 · 메모리 · 퍼즐 — 티니핑과 함께 놀아요.'],
    ['games/memory', '메모리 게임 — 티니핑 도감', '같은 티니핑 짝을 찾는 카드 뒤집기 게임. 3×4부터 8×8까지.'],
    ['games/puzzle', '퍼즐 게임 — 티니핑 도감', '조각을 맞춰 티니핑 그림을 완성하는 퍼즐. 쉬움 3×3부터 고수 6×6까지.'],
    ['games/quiz', '누구일까? — 티니핑 도감', '사진·그림자·확대 사진을 보고 어떤 티니핑인지 맞혀요. 전체·기수별, 3단계 난이도.'],
    ['games/shadow', '그림자 찾기 — 티니핑 도감', '티니핑과 똑같은 그림자를 5개 중에서 찾아요.'],
    ['games/pang', '티니핑 팡팡 — 티니핑 도감', '같은 티니핑 3개를 한 줄로 맞추면 팡! 60초 동안 점수를 모아요.'],
    ['games/catch', '티니핑을 캐치! — 티니핑 도감', '쏙쏙 나오는 티니핑 중 찾는 티니핑만 콕! 30초 캐치 게임.'],
  ];
  for (const [route, title, description] of statics) await emit(route, page(template, { title, description }));

  for (const it of data.items) {
    const summary = [it.season, it.grade, it.emotion && `${it.emotion.split('\n')[0]}의 티니핑`].filter(Boolean).join(' · ');
    const og = `images/og/${it.id}.jpg`;
    await emit(`p/${it.id}`, page(template, {
      title: `${it.nameKo} — 티니핑 도감`,
      description: `${it.nameKo}${summary ? ` (${summary})` : ''}${it.intro ? ` — ${it.intro.slice(0, 80)}` : ''}`,
      ogImage: existsSync(path.join(DIST, og)) ? og : '',
    }));
  }
  console.log(`✔ 정적 경로 ${statics.length + data.items.length}개 + 404.html`);
}

main().catch((e) => { console.error('✖', e.message); process.exit(1); });
