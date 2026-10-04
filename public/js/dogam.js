// 도감 목록: 검색 · 기수/등급 필터 · 랜덤핑
import './random.js';
import { loadData, escapeHtml, pageUrl, gradeChip, artHtml, matches, store } from './data.js';

const $ = (s) => document.querySelector(s);
const state = { q: '', season: '', grade: '', verifiedOnly: false, ...readHash() };

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  return { q: p.get('q') || '', season: p.get('season') || '', grade: p.get('grade') || '' };
}
function writeHash() {
  const p = new URLSearchParams();
  for (const k of ['q', 'season', 'grade']) if (state[k]) p.set(k, state[k]);
  history.replaceState(null, '', p.toString() ? `#${p}` : location.pathname);
}

function pills(container, options, key) {
  const make = (value, label) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pill';
    b.textContent = label;
    b.dataset.value = value;
    b.setAttribute('aria-pressed', String(state[key] === value));
    b.addEventListener('click', () => {
      state[key] = value;
      container.querySelectorAll('.pill').forEach((p) => p.setAttribute('aria-pressed', String(p.dataset.value === value)));
      render();
    });
    return b;
  };
  container.append(make('', '전체'), ...options.map(([v, l]) => make(v, l)));
}

let DATA;
function card(item) {
  const chips = [
    item.season ? `<span class="chip">${escapeHtml(item.season.replace(/^(\d+기).*/, '$1'))}</span>` : '',
    gradeChip(item.grade),
    item.verified ? '' : '<span class="chip unverified" title="공식 도감 대조 전 (Fandom 자동 수집)">미검증</span>',
  ].join('');
  return `<a class="card" href="${pageUrl(item.id)}" style="--c:${escapeHtml(item.colorHex)}">
    <div class="art">${artHtml(item)}</div>
    <div class="name">${escapeHtml(item.nameKo)}</div>
    <div class="en">${escapeHtml(item.nameEn)}</div>
    <div class="chips">${chips}</div>
  </a>`;
}

function render() {
  const list = DATA.items.filter((it) =>
    (!state.season || it.seasonKey === state.season || (state.season === '_none' && !it.seasonKey)) &&
    (!state.grade || it.grade === state.grade) &&
    (!state.verifiedOnly || it.verified) &&
    matches(it, state.q),
  );
  $('#grid').innerHTML = list.map(card).join('');
  $('#empty').hidden = list.length > 0;
  $('#count').textContent = `${list.length} / ${DATA.items.length}마리`;
  writeHash();
}

async function main() {
  try {
    DATA = await loadData();
  } catch (e) {
    $('#grid').innerHTML = `<p class="empty">${escapeHtml(e.message)}</p>`;
    return;
  }
  const seasonsPresent = new Set(DATA.items.map((i) => i.seasonKey));
  const seasonOpts = DATA.seasons.filter((s) => seasonsPresent.has(s.key)).map((s) => [s.key, s.label]);
  if (seasonsPresent.has('')) seasonOpts.push(['_none', '미분류']);
  pills($('#season-filter'), seasonOpts, 'season');
  pills($('#grade-filter'), DATA.grades.map((g) => [g, g]), 'grade');

  const q = $('#q');
  q.value = state.q;
  let t;
  q.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => { state.q = q.value; render(); }, 120);
  });
  const vo = $('#verified-only');
  vo.checked = state.verifiedOnly = store.get('dogam:verifiedOnly', false);
  vo.addEventListener('change', () => { state.verifiedOnly = vo.checked; store.set('dogam:verifiedOnly', vo.checked); render(); });

  render();
}

main();
