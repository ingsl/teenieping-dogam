#!/usr/bin/env node
// 데이터 조립: roster(정본) + Fandom 캐시 + 보조(선택값) + overrides → public/data/teeniepings.json
//
//   node tools/build-data.mjs            Fandom에만 있는 캐릭터도 "미검증"으로 포함
//   node tools/build-data.mjs --strict   roster에 있는 캐릭터만 출력
//
// 병합 우선순위 (아래가 이김): Fandom 캐시 < 보조 소스 selected < roster(이름·기수·등급) < overrides
// 출력 파일은 빌드 산출물이므로 직접 수정하지 말 것. 고칠 값은 src/overrides.json 에.

import path from 'node:path';
import { existsSync } from 'node:fs';
import { PUBLIC, CACHE_FANDOM, CACHE_AUX, ROOT, args, readJson, readJsonDir, writeJson, slugify } from './lib/common.mjs';
import { ROSTER } from '../src/roster.js';
import { SEASONS, GRADES, seasonByKey } from '../src/seasons.js';

const STRICT = args.has('--strict');

const GENDER_WORDS = { female: '여성', male: '남성', unknown: '불명' };
function normalizeGender(raw = '') {
  const parts = [...new Set(raw.split('\n').map((g) => GENDER_WORDS[g.trim().toLowerCase()] || g.trim()).filter(Boolean))];
  return parts.join(' / ');
}

// 이미지가 없을 때 쓰는 파스텔 대표색 (id 해시 기반, 매 빌드 동일)
function fallbackColor(id) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360} 70% 80%)`;
}

const firstLine = (s = '') => s.split('\n')[0] || '';

function fromFandom(f) {
  if (!f) return {};
  return {
    nameEn: f.nameEn,
    nameKo: f.nameKo,
    seasonKey: f.seasonKey,
    grade: f.grade,
    gender: normalizeGender(f.gender),
    emotion: f.concept,
    item: f.prop,
    magic: f.abilities,
    jewel: f.jewel,
    likes: f.likes,
    dislikes: f.dislikes,
    catchphrase: f.catchphrase,
    episodes: f.debut ? [{ episode: firstLine(f.debut), label: '첫 등장', plot: '' }] : [],
    colorHex: f.colorHex,
    _friends: f.friends,
    _enemies: f.enemies,
    source: { fandomUrl: f.url, fandomRevId: f.revid },
    updatedAt: f.fetchedAt,
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
  const fandom = (await readJsonDir(CACHE_FANDOM)).filter((r) => r && !r.isGroup);
  const byId = new Map(fandom.map((r) => [r.id, r]));
  const byKo = new Map(fandom.filter((r) => r.nameKo).map((r) => [r.nameKo, r]));
  const overrides = (await readJson(path.join(ROOT, 'src', 'overrides.json'))) || {};

  const used = new Set();
  const entries = [];

  ROSTER.forEach((r, i) => {
    const f = byId.get(r.id) || byKo.get(r.nameKo);
    if (f) used.add(f.id);
    entries.push({ id: r.id, roster: r, fandom: f, order: i });
  });
  if (!STRICT) {
    for (const f of fandom) {
      if (used.has(f.id) || !f.nameKo) continue;
      entries.push({ id: f.id, roster: null, fandom: f, order: Infinity });
    }
  }

  const items = [];
  for (const { id, roster, fandom: f, order } of entries) {
    const rec = {
      id, nameKo: '', nameEn: '', season: '', seasonKey: '', grade: '', gender: '', emotion: '', intro: '',
      item: '', magic: '', episodes: [], relations: [], colorHex: '', image: '', thumb: '',
      verified: Boolean(roster), source: {}, updatedAt: '',
    };
    assignDefined(rec, fromFandom(f));
    const aux = await readJson(path.join(CACHE_AUX, `${id}.json`));
    const { imageUrl: _ignored, ...auxSelected } = aux?.selected || {};
    assignDefined(rec, auxSelected);
    if (roster) {
      assignDefined(rec, { nameKo: roster.nameKo, seasonKey: roster.season, grade: roster.grade, no: roster.no });
    }
    assignDefined(rec, overrides[id]);

    rec.season = seasonByKey[rec.seasonKey]?.label || '';
    if (!rec.grade && f) rec.grade = '일반';
    if (!rec.colorHex) rec.colorHex = fallbackColor(id);
    if (existsSync(path.join(PUBLIC, 'images', `${id}.webp`))) {
      rec.image = `images/${id}.webp`;
      rec.thumb = existsSync(path.join(PUBLIC, 'images', 'thumb', `${id}.webp`)) ? `images/thumb/${id}.webp` : rec.image;
    }
    rec._order = order;
    items.push(rec);
  }

  // 관계: Fandom 링크 대상 중 도감에 있는 캐릭터만 id 참조로 연결
  const ids = new Set(items.map((r) => r.id));
  for (const rec of items) {
    if (!overrides[rec.id]?.relations) {
      const rel = [];
      for (const t of rec._friends || []) if (ids.has(slugify(t)) && slugify(t) !== rec.id) rel.push({ id: slugify(t), label: '친구' });
      for (const t of rec._enemies || []) if (ids.has(slugify(t)) && slugify(t) !== rec.id) rel.push({ id: slugify(t), label: '라이벌' });
      rec.relations = rel.filter((r, i, a) => a.findIndex((x) => x.id === r.id) === i);
    }
    delete rec._friends;
    delete rec._enemies;
  }

  const seasonOrder = (k) => seasonByKey[k]?.order ?? 999;
  const gradeOrder = (g) => (GRADES.indexOf(g) + 1 || 99);
  items.sort((a, b) =>
    seasonOrder(a.seasonKey) - seasonOrder(b.seasonKey) ||
    Number(b.verified) - Number(a.verified) ||
    a._order - b._order ||
    gradeOrder(a.grade) - gradeOrder(b.grade) ||
    a.nameKo.localeCompare(b.nameKo, 'ko'),
  );
  items.forEach((r) => delete r._order);

  const out = {
    _notice: '빌드 산출물입니다. 직접 수정하지 마세요. 값 수정은 src/overrides.json, 명단은 src/roster.js 에서. (npm run build)',
    _credits: {
      characters: '캐릭터 이름·이미지 © SAMG엔터테인먼트. 비공식·비영리 팬 페이지.',
      fandom: 'https://catchteenieping.fandom.com (CC-BY-SA 3.0)',
    },
    count: items.length,
    seasons: SEASONS.map(({ key, label, order }) => ({ key, label, order })),
    grades: GRADES,
    items,
  };
  await writeJson(path.join(PUBLIC, 'data', 'teeniepings.json'), out);

  // ── 검증 리포트 ──
  const unmatched = entries.filter((e) => e.roster && !e.fandom).map((e) => e.roster.nameKo);
  const fields = ['nameEn', 'seasonKey', 'gender', 'emotion', 'item', 'magic', 'intro', 'image'];
  console.log(`✔ public/data/teeniepings.json — ${items.length}건 (검증 ${items.filter((r) => r.verified).length}, 미검증 ${items.filter((r) => !r.verified).length})`);
  if (unmatched.length) console.log(`  ! roster 중 Fandom 매칭 실패: ${unmatched.join(', ')}  → id를 Fandom 문서명 slug로 맞추거나 overrides로 보정`);
  console.log('  빈 필드 (overrides 보정 대상):');
  for (const k of fields) {
    const empty = items.filter((r) => !r[k] || (Array.isArray(r[k]) && !r[k].length));
    if (empty.length) console.log(`   - ${k.padEnd(9)} ${String(empty.length).padStart(3)}건  예) ${empty.slice(0, 5).map((r) => r.nameKo).join(', ')}`);
  }
}

main().catch((e) => { console.error('✖', e); process.exit(1); });
