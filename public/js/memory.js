// 메모리(카드 짝 맞추기) 게임
import { loadData, escapeHtml, url, shuffle, store, formatTime, confetti } from './data.js';

const LEVELS = [
  { cols: 4, rows: 3, name: '아기', desc: '6쌍 · 처음이라면' },
  { cols: 4, rows: 4, name: '쉬움', desc: '8쌍' },
  { cols: 5, rows: 5, name: '보통', desc: '12쌍 + 보너스 칸' },
  { cols: 6, rows: 6, name: '어려움', desc: '18쌍' },
  { cols: 8, rows: 8, name: '도전', desc: '32쌍 · 고수만!' },
];
// 캐릭터 수가 부족할 때 쓰는 기호 카드
const SYMBOLS = ['💖', '⭐', '🌈', '🍓', '🎀', '🌸', '🍰', '👑', '🔑', '💎', '🌙', '🦄', '🍭', '🎵', '🧁', '🫧', '🌟', '🍀', '🐰', '🦋', '🍒', '🎈', '☁️', '🌻', '🍩', '🪄', '🐱', '🐶', '🍋', '🍇', '🌷', '🔮'];

const $ = (s) => document.querySelector(s);
const keyOf = (lv) => `memory:best:${lv.cols}x${lv.rows}`;

let DATA, level, cards, first, second, lock, moves, found, totalPairs, seconds, timer, started;

function bestText(lv) {
  const b = store.get(keyOf(lv));
  return b ? `최고 ${b.moves}번 · ${formatTime(b.time)}` : '아직 기록 없음';
}

function renderMenu() {
  $('#levels').innerHTML = LEVELS.map((lv, i) => `
    <button class="level" type="button" data-i="${i}">
      <div class="size">${lv.cols}×${lv.rows}</div>
      <div><strong>${lv.name}</strong></div>
      <div class="desc">${lv.desc}</div>
      <div class="best">${bestText(lv)}</div>
    </button>`).join('');
}

function pickFaces(pairs) {
  const season = $('#season').value;
  const withImg = (list) => [...shuffle(list.filter((i) => i.thumb)), ...shuffle(list.filter((i) => !i.thumb))];
  const primary = withImg(DATA.items.filter((i) => !season || i.seasonKey === season));
  const rest = withImg(DATA.items.filter((i) => season && i.seasonKey !== season));
  const faces = [...primary, ...rest].slice(0, pairs).map((i) => ({ key: i.id, item: i }));
  for (let s = 0; faces.length < pairs; s++) faces.push({ key: `sym-${s}`, symbol: SYMBOLS[s % SYMBOLS.length] });
  return faces;
}

function faceHtml(f) {
  if (f.symbol) return `<span class="ph" style="--c:var(--pink)">${f.symbol}</span>`;
  const it = f.item;
  const art = it.thumb
    ? `<img src="${url(it.thumb)}" alt="" draggable="false">`
    : `<span class="ph">${escapeHtml(it.nameKo.slice(0, 1))}</span>`;
  return `${art}<span class="nm">${escapeHtml(it.nameKo)}</span>`;
}

function start(lv) {
  level = lv;
  const cells = lv.cols * lv.rows;
  totalPairs = Math.floor(cells / 2);
  const faces = pickFaces(totalPairs);
  cards = shuffle(faces.flatMap((f) => [f, f]));
  if (cells % 2) cards.splice(Math.floor(cells / 2), 0, { free: true }); // 가운데 보너스 칸

  moves = found = seconds = 0;
  first = second = null;
  lock = started = false;
  clearInterval(timer);
  updateHud();

  const board = $('#board');
  board.style.setProperty('--n', lv.cols);
  board.classList.toggle('compact', lv.cols >= 6);
  board.innerHTML = cards.map((c, i) => {
    if (c.free) return `<div class="mcard free" role="gridcell" aria-label="보너스 칸"><div class="face">🌟</div></div>`;
    const color = c.item?.colorHex || 'var(--pink)';
    const label = c.item ? c.item.nameKo : '기호';
    return `<button class="mcard" type="button" role="gridcell" data-i="${i}" aria-label="뒤집힌 카드 ${i + 1}" data-name="${escapeHtml(label)}" style="--c:${escapeHtml(color)}">
      <div class="inner">
        <div class="face back" aria-hidden="true">♥</div>
        <div class="face front" aria-hidden="true">${faceHtml(c)}</div>
      </div>
    </button>`;
  }).join('');

  $('#menu').hidden = true;
  $('#game').hidden = false;
  board.querySelector('button')?.focus({ preventScroll: true });
}

function updateHud() {
  $('#time').textContent = formatTime(seconds);
  $('#moves').textContent = moves;
  $('#pairs').textContent = `${found}/${totalPairs}`;
}

function flip(el) {
  const i = Number(el.dataset.i);
  if (lock || el.classList.contains('flipped') || el.classList.contains('matched')) return;
  if (!started) {
    started = true;
    timer = setInterval(() => { seconds++; updateHud(); }, 1000);
  }
  el.classList.add('flipped');
  el.setAttribute('aria-label', `${el.dataset.name} 카드`);
  if (!first) { first = { el, i }; return; }
  second = { el, i };
  moves++;
  updateHud();

  if (cards[first.i].key === cards[second.i].key) {
    for (const c of [first, second]) {
      c.el.classList.add('matched');
      c.el.setAttribute('aria-label', `${c.el.dataset.name} 짝 찾음`);
    }
    first = second = null;
    found++;
    updateHud();
    if (found === totalPairs) win();
  } else {
    lock = true;
    setTimeout(() => {
      for (const c of [first, second]) {
        c.el.classList.remove('flipped');
        c.el.classList.add('shake');
        c.el.setAttribute('aria-label', '뒤집힌 카드');
        setTimeout(() => c.el.classList.remove('shake'), 400);
      }
      first = second = null;
      lock = false;
    }, 850);
  }
}

function win() {
  clearInterval(timer);
  const ratio = moves / totalPairs;
  const stars = ratio <= 1.5 ? 3 : ratio <= 2.2 ? 2 : 1;
  const prev = store.get(keyOf(level));
  const isBest = !prev || moves < prev.moves || (moves === prev.moves && seconds < prev.time);
  if (isBest) store.set(keyOf(level), { moves, time: seconds });
  $('#result-stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  $('#result-text').innerHTML = `${level.cols}×${level.rows} · <strong>${moves}번</strong> 만에 · ${formatTime(seconds)}${isBest ? '<br>🎉 최고 기록!' : ''}`;
  setTimeout(() => { confetti(); $('#result').showModal(); }, 500);
}

function toMenu() {
  clearInterval(timer);
  $('#result').close();
  $('#game').hidden = true;
  $('#menu').hidden = false;
  renderMenu();
}

async function main() {
  DATA = await loadData();
  const present = new Set(DATA.items.map((i) => i.seasonKey));
  $('#season').innerHTML += DATA.seasons.filter((s) => present.has(s.key))
    .map((s) => `<option value="${s.key}">${escapeHtml(s.label)}</option>`).join('');
  $('#season').value = store.get('memory:season', '');
  $('#season').addEventListener('change', (e) => store.set('memory:season', e.target.value));

  renderMenu();
  $('#levels').addEventListener('click', (e) => {
    const b = e.target.closest('.level');
    if (b) start(LEVELS[Number(b.dataset.i)]);
  });
  $('#board').addEventListener('click', (e) => {
    const c = e.target.closest('button.mcard');
    if (c) flip(c);
  });
  $('#restart').addEventListener('click', () => start(level));
  $('#back').addEventListener('click', toMenu);
  $('#again').addEventListener('click', () => { $('#result').close(); start(level); });
  $('#to-menu').addEventListener('click', toMenu);
}

main();
