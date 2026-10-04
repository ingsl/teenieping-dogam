#!/usr/bin/env node
// Fandom MediaWiki API 수집기 (주 자동 소스)
//
//   node tools/fetch-fandom.mjs              증분 수집 (revid 같으면 스킵)
//   node tools/fetch-fandom.mjs --force      전량 재수집
//   node tools/fetch-fandom.mjs --limit=10   앞에서 N건만 (파싱 시범용)
//
// 소스: https://catchteenieping.fandom.com (영문, CC-BY-SA 3.0)
// 캐릭터 이름·이미지 저작권은 SAMG엔터테인먼트. 개인·비영리 팬 페이지 용도로만 사용한다.
// 결과: cache/fandom/<id>.json

import path from 'node:path';
import {
  CACHE_FANDOM, args, argValue, politeFetch, readJson, writeJson, slugify,
} from './lib/common.mjs';
import {
  findTemplate, parseTemplateParams, toPlain, linkTargets, imageFiles, countryName,
} from './lib/wikitext.mjs';
import { SEASONS, GRADE_CATEGORIES } from '../src/seasons.js';

const WIKI = 'https://catchteenieping.fandom.com';
const API = `${WIKI}/api.php`;
const CATEGORY = argValue('category', 'Category:Teeniepings');
const FORCE = args.has('--force');
const LIMIT = Number(argValue('limit', 0)) || Infinity;

async function api(params) {
  const qs = new URLSearchParams({ format: 'json', formatversion: '2', maxlag: '5', ...params });
  const res = await politeFetch(`${API}?${qs}`);
  const json = await res.json();
  if (json.error) throw new Error(`API error: ${json.error.code} ${json.error.info}`);
  return json;
}

/** continue 토큰을 따라가며 결과를 합친다. */
async function apiAll(params, onPage) {
  let cont = {};
  for (;;) {
    const json = await api({ ...params, ...cont });
    onPage(json);
    if (!json.continue) break;
    cont = json.continue;
  }
}

async function listMembers() {
  const titles = [];
  await apiAll(
    { action: 'query', list: 'categorymembers', cmtitle: CATEGORY, cmnamespace: '0', cmlimit: '500' },
    (j) => titles.push(...j.query.categorymembers.map((m) => m.title)),
  );
  return titles;
}

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

/** 문서별 최신 revid */
async function latestRevIds(titles) {
  const out = {};
  for (const group of chunk(titles, 50)) {
    const j = await api({ action: 'query', prop: 'info', titles: group.join('|') });
    for (const p of j.query.pages) if (!p.missing) out[p.title] = p.lastrevid;
  }
  return out;
}

/** 본문·분류·대표이미지를 50건 단위로 가져온다. 분류는 continue로 나뉘어 올 수 있어 병합. */
async function fetchPages(titles) {
  const pages = {};
  for (const group of chunk(titles, 50)) {
    await apiAll(
      {
        action: 'query',
        titles: group.join('|'),
        prop: 'revisions|categories|pageimages',
        rvprop: 'content|ids',
        rvslots: 'main',
        cllimit: 'max',
        piprop: 'original',
      },
      (j) => {
        for (const p of j.query.pages) {
          const cur = (pages[p.title] ||= { title: p.title, categories: [] });
          if (p.revisions) cur.revision = p.revisions[0];
          if (p.categories) cur.categories.push(...p.categories.map((c) => c.title.replace(/^Category:/, '')));
          if (p.original) cur.original = p.original.source;
        }
      },
    );
  }
  return Object.values(pages);
}

function deriveSeason(categories) {
  const earliest = (field) =>
    SEASONS.filter((s) => s[field].some((c) => categories.includes(c))).sort((a, b) => a.order - b.order)[0];
  return (earliest('fandomCategories') || earliest('fandomSeries'))?.key || '';
}

// "Royal Teeniepings", "Unknown Teenieping" 처럼 캐릭터 개인이 아닌 묶음/목록 문서
const isGroupPage = (title) => /Teeniepings$|^Unknown Teenieping$/.test(title);

function deriveGrade(categories) {
  return GRADE_CATEGORIES.find((g) => g.categories.some((c) => categories.includes(c)))?.grade || '';
}

const GENDER = { female: '여성', male: '남성' };

function parsePage(page) {
  const content = page.revision?.slots?.main?.content || '';
  const tpl = findTemplate(content, 'Character');
  const p = tpl ? parseTemplateParams(tpl) : {};
  const images = imageFiles(p.image || '');
  const gender = toPlain(p.gender).toLowerCase();
  const id = slugify(page.title);
  return {
    id,
    title: page.title,
    url: `${WIKI}/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
    revid: page.revision?.revid ?? null,
    fetchedAt: new Date().toISOString(),
    license: 'CC-BY-SA 3.0 (Catch! Teenieping Wiki, Fandom)',
    hasInfobox: Boolean(tpl),
    isGroup: isGroupPage(page.title),
    nameEn: toPlain(p.title) || page.title,
    nameKo: countryName(p.international, 'KR'),
    gender: GENDER[gender] || (gender ? toPlain(p.gender) : ''),
    concept: toPlain(p.concept),
    prop: toPlain(p.prop),
    jewel: toPlain(p.jewel),
    abilities: toPlain(p.abilities),
    likes: toPlain(p.likes),
    dislikes: toPlain(p.dislikes),
    catchphrase: toPlain(p.catchphrase),
    debut: toPlain(p.debut),
    colorHex: /^#?[0-9a-f]{6}$/i.test((p.color || '').trim()) ? `#${p.color.trim().replace('#', '').toUpperCase()}` : '',
    friends: linkTargets(p.friends),
    enemies: linkTargets(p.enemies),
    categories: page.categories,
    seasonKey: deriveSeason(page.categories),
    grade: deriveGrade(page.categories),
    images,
    imageUrl: page.original || '',
  };
}

async function main() {
  console.log(`▶ Fandom 수집: ${CATEGORY}${FORCE ? ' (--force)' : ''}`);
  let titles = await listMembers();
  console.log(`  분류 문서 ${titles.length}건`);
  titles = titles.slice(0, LIMIT);

  const revs = await latestRevIds(titles);
  const stale = [];
  for (const t of titles) {
    const cached = await readJson(path.join(CACHE_FANDOM, `${slugify(t)}.json`));
    if (FORCE || !cached || cached.revid !== revs[t]) stale.push(t);
  }
  console.log(`  변경/신규 ${stale.length}건, 스킵 ${titles.length - stale.length}건`);
  if (!stale.length) return;

  const pages = await fetchPages(stale);
  let noBox = 0;
  for (const page of pages) {
    const rec = parsePage(page);
    if (!rec.hasInfobox) noBox++;
    await writeJson(path.join(CACHE_FANDOM, `${rec.id}.json`), rec);
    console.log(`  ✓ ${rec.id.padEnd(22)} ${rec.nameKo || '(한글명 없음)'}  ${rec.seasonKey || '-'} ${rec.grade || ''}`);
  }
  if (noBox) console.warn(`  ! 인포박스 없는 문서 ${noBox}건 (빈 값으로 저장됨)`);
  console.log('✔ 완료');
}

main().catch((e) => {
  console.error('✖', e.message);
  process.exit(1);
});
