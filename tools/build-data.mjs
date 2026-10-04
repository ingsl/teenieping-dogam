#!/usr/bin/env node
// 데이터 조립 → public/data/teeniepings.json
//
//   node tools/build-data.mjs
//
// 소스와 우선순위 (아래가 이김)
//   1. Fandom 캐시 (cache/fandom)  — 명단, 영문명, 기수·등급 분류, 대표색, 관계
//   2. 나무위키 캐시 (cache/extra) — 한국어 상세: 성별·감정·소품·마법·좋아하는 것·첫 등장·소개, 등급 보조
//   3. src/roster.js               — (선택) 사람이 확정한 이름·기수·등급
//   4. src/overrides.json          — (선택) 사람이 고친 값. 모든 소스를 이김
// 화면에는 한국어만 보인다. Fandom의 영문 설명 문장은 쓰지 않는다 (영문명 제외).
// 출력 파일은 빌드 산출물이므로 직접 수정하지 말 것.

import path from 'node:path';
import { existsSync } from 'node:fs';
import { PUBLIC, CACHE_FANDOM, CACHE_AUX, ROOT, readJson, readJsonDir, writeJson, slugify } from './lib/common.mjs';
import { seasonFromCategories, seasonFromDebut, gradeFromCategories, gradeFromNamu } from './lib/classify.mjs';
import { ROSTER } from '../src/roster.js';
import { SEASONS, GRADES, seasonByKey } from '../src/seasons.js';

const GENDER_WORDS = { female: '여성', male: '남성', unknown: '불명', 여자: '여성', 남자: '남성' };
function normalizeGender(raw = '') {
  const parts = [...new Set(raw.split(/\n|,|\//).map((g) => GENDER_WORDS[g.trim().toLowerCase()] || g.trim()).filter(Boolean))];
  return parts.join(' / ');
}

// 이미지가 없을 때 쓰는 파스텔 대표색 (id 해시 기반, 매 빌드 동일)
function fallbackColor(id) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360} 70% 80%)`;
}

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

function fromNamu(n, current) {
  if (!n) return {};
  return {
    gender: normalizeGender(n.gender),
    emotion: n.emotion,
    intro: n.intro,
    item: n.item,
    magic: n.magic,
    jewel: n.jewel,
    likes: n.likes,
    dislikes: n.dislikes,
    favoriteFood: n.favoriteFood,
    birthday: n.birthday,
    motif: n.motif,
    symbol: n.symbol,
    partner: n.partner,
    voice: n.voice,
    episodes: n.debut ? [{ episode: n.debut, label: '첫 등장', plot: '' }] : [],
    // 등급·기수는 Fandom이 못 정했을 때만 나무위키로 보완
    grade: current.grade || gradeFromNamu(n.classification),
    seasonKey: current.seasonKey || seasonFromDebut(n.debut),
    source: { namuUrl: n.url },
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
  const byId = new Map(fandom.map((r) => [r.id, r]));
  const byKo = new Map(fandom.map((r) => [r.nameKo, r]));
  const rosterById = new Map(ROSTER.map((r) => [r.id, r]));
  const overrides = (await readJson(path.join(ROOT, 'src', 'overrides.json'))) || {};

  // 명단 = Fandom 전체 + roster에만 있는 캐릭터
  const entries = fandom.map((f) => ({ id: f.id, fandom: f }));
  for (const r of ROSTER) {
    const f = byId.get(r.id) || byKo.get(r.nameKo);
    if (!f) entries.push({ id: r.id, fandom: null });
    else if (f.id !== r.id) rosterById.set(f.id, r);
  }

  const items = [];
  for (const { id, fandom: f } of entries) {
    const roster = rosterById.get(id);
    const namu = (await readJson(path.join(CACHE_AUX, `${id}.json`)))?.namu;
    const rec = {
      id, nameKo: '', nameEn: '', season: '', seasonKey: '', grade: '', gender: '', emotion: '', intro: '',
      item: '', magic: '', episodes: [], relations: [], colorHex: '', image: '', thumb: '',
      verified: false, source: {}, updatedAt: '',
    };
    assignDefined(rec, fromFandom(f));
    assignDefined(rec, fromNamu(namu, rec));
    if (roster) assignDefined(rec, { nameKo: roster.nameKo, seasonKey: roster.season, grade: roster.grade, no: roster.no });
    assignDefined(rec, overrides[id]);

    // 두 위키(Fandom·나무위키)에 모두 있거나 사람이 roster에 적은 캐릭터 = 확인됨
    rec.verified = Boolean(roster) || Boolean(f && namu);
    rec.season = seasonByKey[rec.seasonKey]?.label || '';
    if (!rec.grade) rec.grade = '일반';
    if (!rec.colorHex) rec.colorHex = fallbackColor(id);
    if (existsSync(path.join(PUBLIC, 'images', `${id}.webp`))) {
      rec.image = `images/${id}.webp`;
      rec.thumb = existsSync(path.join(PUBLIC, 'images', 'thumb', `${id}.webp`)) ? `images/thumb/${id}.webp` : rec.image;
    }
    rec._friends = f?.friends || [];
    rec._enemies = f?.enemies || [];
    items.push(rec);
  }

  // 이미지가 없거나 한쪽 위키에서만 확인된 항목(그룹 문서·정령 등)은 도감에서 뺀다.
  // overrides 에 { "<id>": { "keep": true } } 를 주면 예외로 남긴다.
  const excluded = [];
  for (let i = items.length - 1; i >= 0; i--) {
    const r = items[i];
    if ((!r.image || !r.verified) && !overrides[r.id]?.keep) excluded.push(...items.splice(i, 1));
  }
  for (const r of items) delete r.keep;

  // 관계: Fandom 링크 대상 중 도감에 있는 캐릭터만 id 참조로 연결
  const ids = new Set(items.map((r) => r.id));
  for (const rec of items) {
    if (!overrides[rec.id]?.relations) {
      const rel = [];
      for (const t of rec._friends) if (ids.has(slugify(t)) && slugify(t) !== rec.id) rel.push({ id: slugify(t), label: '친구' });
      for (const t of rec._enemies) if (ids.has(slugify(t)) && slugify(t) !== rec.id) rel.push({ id: slugify(t), label: '라이벌' });
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
    _notice: '빌드 산출물입니다. 직접 수정하지 마세요. 값 수정은 src/overrides.json 에서. (npm run build)',
    _credits: {
      characters: '캐릭터 이름·이미지 © SAMG엔터테인먼트. 비공식·비영리 팬 페이지.',
      namu: 'https://namu.wiki (CC BY-NC-SA 2.0 KR)',
      fandom: 'https://catchteenieping.fandom.com (CC BY-SA 3.0)',
    },
    count: items.length,
    seasons: SEASONS.map(({ key, label, order }) => ({ key, label, order })),
    grades: GRADES,
    items,
  };
  await writeJson(path.join(PUBLIC, 'data', 'teeniepings.json'), out);

  // ── 리포트 ──
  console.log(`✔ public/data/teeniepings.json — ${items.length}건 (모두 이미지 있음 · 두 위키 확인)`);
  if (excluded.length) console.log(`  제외 ${excluded.length}건 (이미지 없음 또는 미확인): ${excluded.map((r) => r.nameKo).join(', ')}`);
  const fields = ['seasonKey', 'gender', 'emotion', 'item', 'magic', 'intro', 'image'];
  console.log('  빈 필드:');
  for (const k of fields) {
    const empty = items.filter((r) => !r[k] || (Array.isArray(r[k]) && !r[k].length));
    if (empty.length) console.log(`   - ${k.padEnd(9)} ${String(empty.length).padStart(3)}건  예) ${empty.slice(0, 6).map((r) => r.nameKo).join(', ')}`);
  }
}

main().catch((e) => { console.error('✖', e); process.exit(1); });
