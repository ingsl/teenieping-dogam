#!/usr/bin/env node
// 데이터 조립 → public/data/teeniepings.json
//
//   node tools/build-data.mjs
//
// 소스 우선순위 (위가 이김)
//   1. content/overrides.json   — (선택) 사람이 고친 값
//   2. content/roster.js        — (선택) 사람이 확정한 이름·기수·등급
//   3. 나무위키 (cache/extra)    — ★ 1순위 자동 소스: 명단·기수·등급(「티니핑」 문서 분류), 한국어 설명 전부, 대표 이미지
//   4. Fandom (cache/fandom)    — 나무위키에 없을 때만: 명단 보충, 영문명, 성별·기수·등급, 대표색, 관계, 이미지
// 화면은 한국어만 → Fandom 의 영어 설명 문장은 쓰지 않는다.
// 나무위키·Fandom 어디에도 정보가 없거나 이미지가 없으면 도감에서 뺀다.
// 출력 파일은 빌드 산출물이므로 직접 수정하지 말 것.

import path from 'node:path';
import { existsSync } from 'node:fs';
import { PUBLIC, CACHE_FANDOM, CACHE_AUX, ROOT, readJson, readJsonDir, writeJson, slugify } from './lib/common.mjs';
import { seasonFromCategories, seasonFromDebut, gradeFromCategories, gradeFromNamu } from './lib/classify.mjs';
import { ROSTER } from '../content/roster.js';
import { SEASONS, GRADES, seasonByKey } from '../content/seasons.js';

const GENDER_WORDS = { female: '여성', male: '남성', unknown: '불명', 여자: '여성', 남자: '남성' };
function normalizeGender(raw = '') {
  const parts = [...new Set(raw.split(/\n|,|\//).map((g) => GENDER_WORDS[g.trim().toLowerCase()] || g.trim()).filter(Boolean))];
  return parts.join(' / ');
}

// 대표색이 없을 때 (id 해시 기반, 매 빌드 동일)
function fallbackColor(id) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360} 70% 80%)`;
}

/** Fandom: 나무위키에 없을 때 쓰는 보충값 (영어 문장은 제외) */
function fromFandom(f) {
  if (!f) return {};
  return {
    nameEn: f.nameEn,
    nameKo: f.nameKo,
    seasonKey: seasonFromCategories(f.categories),
    grade: gradeFromCategories(f.categories),
    gender: normalizeGender(f.gender),
    colorHex: f.colorHex,
    source: { fandomUrl: f.url, fandomRevId: f.revid },
    updatedAt: f.fetchedAt,
  };
}

/** 나무위키 캐릭터 문서 + 「티니핑」 명단 분류 */
function fromNamu(n, listed) {
  if (!n && !listed) return {};
  return {
    nameKo: listed?.nameKo,
    nameEn: n?.nameEn,
    seasonKey: listed?.season,
    grade: listed?.grade || gradeFromNamu(n?.classification),
    gender: normalizeGender(n?.gender),
    emotion: n?.emotion,
    intro: n?.intro,
    item: n?.item,
    magic: n?.magic,
    jewel: n?.jewel,
    likes: n?.likes,
    dislikes: n?.dislikes,
    favoriteFood: n?.favoriteFood,
    birthday: n?.birthday,
    motif: n?.motif,
    symbol: n?.symbol,
    partner: n?.partner,
    voice: n?.voice,
    episodes: n?.debut ? [{ episode: n.debut, label: '첫 등장', plot: '' }] : [],
    source: n ? { namuUrl: n.url } : {},
  };
}

/** 값이 비어 있지 않은 필드만 덮어쓴다 (빈 값이 기존 값을 지우지 않게). */
function assignDefined(target, patch = {}) {
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) continue;
    if (k === 'source' && typeof v === 'object') target.source = { ...target.source, ...v };
    else target[k] = v;
  }
  return target;
}

async function main() {
  const fandom = (await readJsonDir(CACHE_FANDOM)).filter((r) => r && !r.isGroup && r.nameKo);
  const fandomById = new Map(fandom.map((r) => [r.id, r]));
  const namuDocs = (await readJsonDir(CACHE_AUX)).filter((r) => r?.id && r.namu);
  const namuById = new Map(namuDocs.map((r) => [r.id, r]));
  const listed = new Map(((await readJson(path.join(CACHE_AUX, '_roster.json'))) || []).map((r) => [r.nameKo, r]));
  const rosterById = new Map(ROSTER.map((r) => [r.id, r]));
  const overrides = (await readJson(path.join(ROOT, 'content', 'overrides.json'))) || {};

  // 명단 = 나무위키 ∪ Fandom (id 기준)
  const ids = [...new Set([...namuById.keys(), ...fandomById.keys(), ...rosterById.keys()])];

  const items = [];
  const excluded = [];
  for (const id of ids) {
    const f = fandomById.get(id);
    const n = namuById.get(id);
    const nameKo = n?.nameKo || f?.nameKo || rosterById.get(id)?.nameKo;
    const l = listed.get(nameKo);
    const rec = {
      id, nameKo: '', nameEn: '', season: '', seasonKey: '', grade: '', gender: '', emotion: '', intro: '',
      item: '', magic: '', episodes: [], relations: [], colorHex: '', image: '', thumb: '', source: {}, updatedAt: '',
    };
    assignDefined(rec, fromFandom(f));              // 4순위
    assignDefined(rec, fromNamu(n?.namu, l));       // 3순위 (나무위키가 이김)
    if (!rec.seasonKey) rec.seasonKey = seasonFromDebut(n?.namu?.debut);
    const roster = rosterById.get(id);
    if (roster) assignDefined(rec, { nameKo: roster.nameKo, seasonKey: roster.season, grade: roster.grade, no: roster.no });
    assignDefined(rec, overrides[id]);

    rec.season = seasonByKey[rec.seasonKey]?.label || '';
    if (!rec.grade) rec.grade = '일반';
    if (!rec.colorHex) rec.colorHex = fallbackColor(id);
    if (existsSync(path.join(PUBLIC, 'images', `${id}.webp`))) {
      rec.image = `images/${id}.webp`;
      rec.thumb = existsSync(path.join(PUBLIC, 'images', 'thumb', `${id}.webp`)) ? `images/thumb/${id}.webp` : rec.image;
    }
    rec._friends = f?.friends || [];
    rec._enemies = f?.enemies || [];

    // 정보(나무위키·Fandom)도 이미지도 있어야 도감에 넣는다. overrides 의 keep: true 는 예외
    const hasInfo = Boolean(n?.namu || f?.hasInfobox || roster);
    const keep = overrides[id]?.keep;
    delete rec.keep;
    if (!keep && (!rec.image || !hasInfo || !rec.nameKo)) {
      excluded.push({ ...rec, why: !rec.image ? '이미지 없음' : '정보 없음' });
      continue;
    }
    items.push(rec);
  }

  // 관계: Fandom 링크 대상 중 도감에 있는 캐릭터만 id 참조로 연결
  const idSet = new Set(items.map((r) => r.id));
  for (const rec of items) {
    if (!overrides[rec.id]?.relations) {
      const rel = [];
      for (const t of rec._friends) if (idSet.has(slugify(t)) && slugify(t) !== rec.id) rel.push({ id: slugify(t), label: '친구' });
      for (const t of rec._enemies) if (idSet.has(slugify(t)) && slugify(t) !== rec.id) rel.push({ id: slugify(t), label: '라이벌' });
      rec.relations = rel.filter((r, i, a) => a.findIndex((x) => x.id === r.id) === i);
    }
    delete rec._friends;
    delete rec._enemies;
  }

  const seasonOrder = (k) => seasonByKey[k]?.order ?? 999;
  const gradeOrder = (g) => (GRADES.indexOf(g) + 1 || 99);
  items.sort((a, b) =>
    seasonOrder(a.seasonKey) - seasonOrder(b.seasonKey) ||
    gradeOrder(a.grade) - gradeOrder(b.grade) ||
    a.nameKo.localeCompare(b.nameKo, 'ko'),
  );

  const out = {
    _notice: '빌드 산출물입니다. 직접 수정하지 마세요. 값 수정은 content/overrides.json 에서. (npm run build)',
    _credits: {
      characters: '캐릭터 이름·이미지 © SAMG엔터테인먼트. 비공식·비영리 팬 페이지.',
      namu: 'https://namu.wiki (CC BY-NC-SA 2.0 KR)',
      fandom: 'https://catchteenieping.fandom.com (CC BY-SA 3.0)',
    },
    count: items.length,
    seasons: SEASONS.map(({ key, label, order }) => ({ key, label, order })),
    grades: GRADES.filter((g) => items.some((r) => r.grade === g)),
    items,
  };
  await writeJson(path.join(PUBLIC, 'data', 'teeniepings.json'), out);

  // ── 리포트 ──
  console.log(`✔ public/data/teeniepings.json — ${items.length}건 (나무위키 우선 · 이미지 있음)`);
  if (excluded.length) console.log(`  제외 ${excluded.length}건: ${excluded.map((r) => `${r.nameKo || r.id}(${r.why})`).join(', ')}`);
  const bySource = { 나무위키: items.filter((r) => r.source.namuUrl).length, 'Fandom만': items.filter((r) => !r.source.namuUrl).length };
  console.log(`  출처: 나무위키 ${bySource['나무위키']}명, Fandom만 ${bySource['Fandom만']}명`);
  const fields = ['seasonKey', 'gender', 'emotion', 'item', 'magic', 'intro', 'image'];
  console.log('  빈 필드:');
  for (const k of fields) {
    const empty = items.filter((r) => !r[k] || (Array.isArray(r[k]) && !r[k].length));
    if (empty.length) console.log(`   - ${k.padEnd(9)} ${String(empty.length).padStart(3)}건  예) ${empty.slice(0, 6).map((r) => r.nameKo).join(', ')}`);
  }
}

main().catch((e) => { console.error('✖', e); process.exit(1); });
