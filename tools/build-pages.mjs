#!/usr/bin/env node
// 정적 상세 페이지 생성: public/data/teeniepings.json → public/p/<id>.html, public/data/ping-ids.json
// OG 메타(공유 미리보기) 포함. 생성물은 직접 수정하지 말 것.
//
// 사이트 절대 URL(OG 이미지에 필요)은 환경변수 SITE_URL 로 지정. 예) https://user.github.io/teenieping-dogam/

import path from 'node:path';
import { rm, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { PUBLIC, readJson, writeJson } from './lib/common.mjs';

const SITE_URL = (process.env.SITE_URL || '').replace(/\/?$/, '/');
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const GRADE_CLASS = { 로열: 'royal', 레전드: 'legend', 빌런: 'villain' };

function layout({ title, description, ogImage, body, current = '' }) {
  const abs = (p) => (SITE_URL !== '/' ? SITE_URL + p : '');
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:type" content="article">
  ${ogImage && abs(ogImage) ? `<meta property="og:image" content="${esc(abs(ogImage))}">\n  <meta name="twitter:card" content="summary_large_image">` : ''}
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>💖</text></svg>">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jua&display=swap">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
  <link rel="stylesheet" href="../css/style.css">
</head>
<body>
  <!-- 빌드 산출물(tools/build-pages.mjs). 직접 수정 금지. -->
  <header class="site-header">
    <div class="inner">
      <a class="logo" href="../"><span class="heart">💖</span>티니핑 도감</a>
      <nav class="site-nav" aria-label="주 메뉴">
        <a href="../"${current === 'dogam' ? ' aria-current="page"' : ''}>도감</a>
        <a href="../games/">게임</a>
        <a href="#" id="random-link">랜덤핑</a>
      </nav>
    </div>
  </header>
  <main>
${body}
  </main>
  <footer class="site-footer">
    <div class="inner">
      <p><strong>비공식·비영리 팬 페이지</strong>입니다. 광고·후원·판매 등 어떠한 수익화도 하지 않습니다.</p>
      <p>'캐치! 티니핑' 캐릭터의 이름·이미지 등 모든 권리는 <strong>SAMG엔터테인먼트</strong>에 있습니다.</p>
      <p>캐릭터 정보 출처: <a href="https://namu.wiki/" rel="noopener">나무위키</a> (<a href="https://creativecommons.org/licenses/by-nc-sa/2.0/kr/" rel="noopener license">CC BY-NC-SA 2.0 KR</a>), <a href="https://catchteenieping.fandom.com/" rel="noopener">Catch! Teenieping Wiki (Fandom)</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/" rel="noopener license">CC BY-SA 3.0</a>). 각 상세 페이지에 원문 링크가 있습니다.</p>
    </div>
  </footer>
  <script type="module" src="../js/detail.js"></script>
</body>
</html>
`;
}

function detailBody(it, byId) {
  const art = it.image
    ? `<img src="../${esc(it.image)}" alt="${esc(it.nameKo)}" width="640" height="640">`
    : `<span class="placeholder" style="font-family:var(--font-display);font-size:6rem;color:#fff">${esc(it.nameKo.slice(0, 1))}</span>`;
  const fact = (label, v) => (v ? `<dt>${label}</dt><dd>${esc(v)}</dd>` : '');
  const relations = (it.relations || [])
    .map((r) => {
      const o = byId.get(r.id);
      if (!o) return '';
      const img = o.thumb ? `<img src="../${esc(o.thumb)}" alt="" loading="lazy">` : '<span aria-hidden="true">💗</span>';
      return `<a href="${esc(o.id)}.html">${img}${esc(o.nameKo)} <small>${esc(r.label)}</small></a>`;
    })
    .join('');
  const episodes = (it.episodes || [])
    .map((e) => `<li>${e.label ? `<strong>${esc(e.label)}</strong> · ` : ''}${esc(e.episode)}${e.plot ? `<br><small>${esc(e.plot)}</small>` : ''}</li>`)
    .join('');
  const src = it.source || {};
  const sources = [
    src.fandomUrl ? `<a href="${esc(src.fandomUrl)}" rel="noopener">Fandom 위키 문서</a> (CC BY-SA 3.0)` : '',
    src.namuUrl ? `<a href="${esc(src.namuUrl)}" rel="noopener">나무위키 문서</a> (CC BY-NC-SA 2.0 KR)` : '',
  ].filter(Boolean).join(' · ');

  return `    <article class="detail" style="--c:${esc(it.colorHex)}">
      <div class="portrait">${art}</div>
      <div>
        <h1>${esc(it.nameKo)}</h1>
        <p class="sub">${esc(it.nameEn)}</p>
        <div class="chips" style="display:flex;gap:6px;flex-wrap:wrap">
          ${it.season ? `<span class="chip">${esc(it.season)}</span>` : ''}
          ${it.grade ? `<span class="chip ${GRADE_CLASS[it.grade] || ''}">${esc(it.grade)}</span>` : ''}
          ${it.verified ? '' : '<span class="chip unverified" title="한쪽 위키에서만 확인된 캐릭터">미확인</span>'}
        </div>
        ${it.intro ? `<p class="intro">${esc(it.intro)}</p>` : ''}
        <dl class="facts">
          ${fact('기수', it.season)}${fact('등급', it.grade)}${fact('성별', it.gender)}${fact('감정·상징', it.emotion)}
          ${fact('생일', it.birthday)}${fact('모티브', it.motif)}${fact('심볼', it.symbol)}${fact('소품', it.item)}${fact('보석', it.jewel)}
          ${fact('파트너', it.partner)}${fact('좋아하는 것', it.likes)}${fact('싫어하는 것', it.dislikes)}${fact('좋아하는 음식', it.favoriteFood)}
          ${fact('성우', it.voice)}
        </dl>
        <button class="btn like-btn" type="button" data-id="${esc(it.id)}" hidden>💗 좋아요 <span class="like-count"></span></button>
      </div>
    </article>
    ${it.magic ? `<section class="section"><h2>✨ 마법</h2><p style="white-space:pre-line;margin:0">${esc(it.magic)}</p></section>` : ''}
    ${episodes ? `<section class="section"><h2>📺 에피소드</h2><ul>${episodes}</ul></section>` : ''}
    ${relations ? `<section class="section"><h2>🤝 관계</h2><div class="relations">${relations}</div></section>` : ''}
    <p class="source-note">출처: ${sources || '직접 입력'}. 위키 내용을 자동으로 모은 것이라 틀린 부분이 있을 수 있어요.</p>`;
}

async function main() {
  const data = await readJson(path.join(PUBLIC, 'data', 'teeniepings.json'));
  if (!data) throw new Error('public/data/teeniepings.json 이 없습니다. 먼저 build-data 를 실행하세요.');
  const outDir = path.join(PUBLIC, 'p');
  if (existsSync(outDir)) await rm(outDir, { recursive: true });
  await mkdir(outDir, { recursive: true });
  const byId = new Map(data.items.map((i) => [i.id, i]));

  for (const it of data.items) {
    const description = [it.nameEn, it.season, it.grade, it.emotion && it.emotion.split('\n')[0]].filter(Boolean).join(' · ');
    const html = layout({
      title: `${it.nameKo} — 티니핑 도감`,
      description: `${it.nameKo}${description ? ` (${description})` : ''} — 비공식 팬 도감`,
      ogImage: existsSync(path.join(PUBLIC, 'images', 'og', `${it.id}.jpg`)) ? `images/og/${it.id}.jpg` : '',
      body: detailBody(it, byId),
      current: 'dogam',
    });
    await writeFile(path.join(outDir, `${it.id}.html`), html, 'utf8');
  }
  await writeJson(path.join(PUBLIC, 'data', 'ping-ids.json'), data.items.map((i) => i.id));
  console.log(`✔ public/p/*.html ${data.items.length}건, public/data/ping-ids.json`);
}

main().catch((e) => { console.error('✖', e.message); process.exit(1); });
