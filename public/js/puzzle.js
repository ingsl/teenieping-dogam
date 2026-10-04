// 퍼즐 게임: 바꾸기(swap) / 슬라이드(slide) × 난이도 3~6
import { loadData, escapeHtml, url, shuffle, store, formatTime, confetti, matches, characterCanvas } from './data.js';

const LEVELS = [
  { n: 3, name: '쉬움' },
  { n: 4, name: '보통' },
  { n: 5, name: '어려움' },
  { n: 6, name: '고수' },
];
const $ = (s) => document.querySelector(s);
const bestKey = (mode, n) => `puzzle:best:${mode}:${n}`;

const state = { mode: store.get('puzzle:mode', 'swap'), item: null, upload: null, imageUrl: '' };
let DATA, n, pos, empty, selected, moves, seconds, timer, started, solved;

// ── 메뉴 ──
function renderLevels() {
  $('#levels').innerHTML = LEVELS.map((lv) => {
    const b = store.get(bestKey(state.mode, lv.n));
    return `<button class="level" type="button" data-n="${lv.n}">
      <div class="size">${lv.n}×${lv.n}</div>
      <div><strong>${lv.name}</strong></div>
      <div class="desc">${lv.n * lv.n}조각</div>
      <div class="best">${b ? `최고 ${b.moves}번 · ${formatTime(b.time)}` : '아직 기록 없음'}</div>
    </button>`;
  }).join('');
}

function renderPicker(q = '') {
  const list = DATA.items.filter((i) => matches(i, q));
  $('#picker').innerHTML = list.map((i) => `
    <button type="button" data-id="${escapeHtml(i.id)}" aria-pressed="${state.item?.id === i.id && !state.upload}">
      ${i.thumb ? `<img src="${url(i.thumb)}" alt="" loading="lazy">` : `<span style="width:56px;height:56px;border-radius:50%;background:${escapeHtml(i.colorHex)};display:grid;place-items:center;color:#fff;font-family:var(--font-display);font-size:1.4rem">${escapeHtml(i.nameKo.slice(0, 1))}</span>`}
      ${escapeHtml(i.nameKo)}
    </button>`).join('');
}

async function choose(item) {
  state.item = item;
  state.upload = null;
  store.set('puzzle:item', item.id);
  const canvas = await characterCanvas(item, 720);
  state.imageUrl = canvas.toDataURL('image/png');
  paintPreview(item.nameKo);
}

function chooseUpload(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    // 정사각형으로 가운데 자르기
    const img = new Image();
    img.src = reader.result;
    await img.decode();
    const s = Math.min(img.width, img.height);
    const c = document.createElement('canvas');
    c.width = c.height = 720;
    c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 720, 720);
    state.upload = file.name;
    state.imageUrl = c.toDataURL('image/jpeg', 0.9);
    paintPreview('내 사진');
  };
  reader.readAsDataURL(file);
}

function paintPreview(name) {
  $('#preview').style.backgroundImage = `url(${state.imageUrl})`;
  $('#picked-name').textContent = name;
  $('#picker').querySelectorAll('button').forEach((b) =>
    b.setAttribute('aria-pressed', String(!state.upload && b.dataset.id === state.item?.id)));
}

// ── 게임 ──
const isSolved = () => pos.every((p, t) => p === t);

function shuffleBoard() {
  const cells = n * n;
  pos = [...Array(cells).keys()];
  if (state.mode === 'swap') {
    do { pos = shuffle(pos); } while (isSolved());
    empty = -1;
  } else {
    // 완성 상태에서 무작위로 빈칸을 움직여 섞는다 → 항상 풀 수 있음
    empty = cells - 1;
    let emptyCell = cells - 1, prev = -1;
    const at = [...pos]; // at[cell] = tile
    for (let k = 0; k < cells * 30 || at.every((t, c) => t === c); k++) {
      const nb = neighbors(emptyCell).filter((c) => c !== prev);
      const c = nb[Math.floor(Math.random() * nb.length)];
      [at[emptyCell], at[c]] = [at[c], at[emptyCell]];
      prev = emptyCell;
      emptyCell = c;
    }
    at.forEach((t, c) => { pos[t] = c; });
  }
}

function neighbors(cell) {
  const r = Math.floor(cell / n), c = cell % n, out = [];
  if (r > 0) out.push(cell - n);
  if (r < n - 1) out.push(cell + n);
  if (c > 0) out.push(cell - 1);
  if (c < n - 1) out.push(cell + 1);
  return out;
}

function placeTiles() {
  const board = $('#board');
  for (const el of board.querySelectorAll('.tile')) {
    const t = Number(el.dataset.t);
    const cell = pos[t];
    el.style.left = `${(cell % n) * (100 / n)}%`;
    el.style.top = `${Math.floor(cell / n) * (100 / n)}%`;
    el.setAttribute('aria-label', `${t + 1}번 조각, ${Math.floor(cell / n) + 1}행 ${(cell % n) + 1}열`);
    el.classList.toggle('correct-hint', state.mode === 'swap' && cell === t);
  }
}

function start(size) {
  n = size;
  moves = seconds = 0;
  started = solved = false;
  selected = null;
  clearInterval(timer);
  shuffleBoard();

  const board = $('#board');
  board.className = 'puzzle-board';
  board.style.setProperty('--n', n);
  const tiles = [];
  for (let t = 0; t < n * n; t++) {
    if (t === empty) continue;
    const bx = (t % n) * (100 / (n - 1)), by = Math.floor(t / n) * (100 / (n - 1));
    tiles.push(`<button class="tile" type="button" data-t="${t}" style="background-image:url(${state.imageUrl});background-position:${bx}% ${by}%"><span class="num">${t + 1}</span></button>`);
  }
  board.innerHTML = `${tiles.join('')}<div class="full" style="background-image:url(${state.imageUrl})"></div>`;
  const showNum = store.get('puzzle:showNum', true);
  board.classList.toggle('hide-num', !showNum);
  $('#toggle-num').setAttribute('aria-pressed', String(showNum));
  placeTiles();
  updateHud();
  $('#hint').textContent = state.mode === 'swap'
    ? '두 조각을 차례로 누르면 자리가 바뀌어요. 제자리에 온 조각은 초록 테두리!'
    : '빈칸 옆(같은 줄) 조각을 누르면 밀려요. 키보드 화살표도 돼요.';
  $('#menu').hidden = true;
  $('#game').hidden = false;
}

function updateHud() {
  $('#time').textContent = formatTime(seconds);
  $('#moves').textContent = moves;
}

function tick() {
  if (!started) {
    started = true;
    timer = setInterval(() => { seconds++; updateHud(); }, 1000);
  }
  moves++;
  updateHud();
  placeTiles();
  if (isSolved()) win();
}

const tileAt = (cell) => pos.findIndex((p) => p === cell);

function onTile(t) {
  if (solved) return;
  if (state.mode === 'swap') {
    const el = $(`#board .tile[data-t="${t}"]`);
    if (selected === null) { selected = t; el.classList.add('selected'); return; }
    $(`#board .tile[data-t="${selected}"]`).classList.remove('selected');
    if (selected !== t) {
      [pos[selected], pos[t]] = [pos[t], pos[selected]];
      selected = null;
      tick();
    } else selected = null;
    return;
  }
  // 슬라이드: 빈칸과 같은 행/열이면 사이 조각을 한꺼번에 민다
  const cell = pos[t], e = pos[empty];
  const sameRow = Math.floor(cell / n) === Math.floor(e / n), sameCol = cell % n === e % n;
  if (!sameRow && !sameCol) return;
  const step = sameRow ? (cell < e ? -1 : 1) : (cell < e ? -n : n);
  for (let c = e; c !== cell; c += step) {
    const mover = tileAt(c + step);
    pos[mover] = c;
  }
  pos[empty] = cell;
  tick();
}

function onKey(e) {
  if ($('#game').hidden || solved || state.mode !== 'slide') return;
  const dir = { ArrowUp: n, ArrowDown: -n, ArrowLeft: 1, ArrowRight: -1 }[e.key];
  if (!dir) return;
  const e0 = pos[empty], from = e0 + dir;
  if (from < 0 || from >= n * n) return;
  if (Math.abs(dir) === 1 && Math.floor(from / n) !== Math.floor(e0 / n)) return;
  e.preventDefault();
  onTile(tileAt(from));
}

function win() {
  solved = true;
  clearInterval(timer);
  $('#board').classList.add('solved'); // 완성 그림(.full)이 빈칸까지 채운다
  // 바꾸기는 최소 n*n-1번 이하로 풀 수 있고, 슬라이드는 훨씬 많이 든다
  const par = state.mode === 'swap' ? n * n : n * n * n * 1.6;
  const stars = moves <= par ? 3 : moves <= par * 1.8 ? 2 : 1;
  const key = bestKey(state.mode, n);
  const prev = store.get(key);
  const isBest = !prev || moves < prev.moves || (moves === prev.moves && seconds < prev.time);
  if (isBest) store.set(key, { moves, time: seconds });
  $('#result-stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  $('#result-text').innerHTML = `${n}×${n} ${state.mode === 'swap' ? '바꾸기' : '슬라이드'} · <strong>${moves}번</strong> · ${formatTime(seconds)}${isBest ? '<br>🎉 최고 기록!' : ''}`;
  setTimeout(() => { confetti(); $('#result').showModal(); }, 700);
}

function toMenu() {
  clearInterval(timer);
  $('#result').close();
  $('#game').hidden = true;
  $('#menu').hidden = false;
  renderLevels();
}

async function main() {
  DATA = await loadData();
  renderPicker();
  renderLevels();

  const modeButtons = $('#mode').querySelectorAll('.pill');
  const paintMode = () => modeButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode)));
  paintMode();
  $('#mode').addEventListener('click', (e) => {
    const b = e.target.closest('.pill');
    if (!b) return;
    state.mode = b.dataset.mode;
    store.set('puzzle:mode', state.mode);
    paintMode();
    renderLevels();
  });

  const withImage = DATA.items.filter((i) => i.image);
  const randomItem = () => { const pool = withImage.length ? withImage : DATA.items; return pool[Math.floor(Math.random() * pool.length)]; };
  await choose(DATA.items.find((i) => i.id === store.get('puzzle:item')) || randomItem());

  $('#picker').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) choose(DATA.items.find((i) => i.id === b.dataset.id));
  });
  $('#random-pick').addEventListener('click', () => choose(randomItem()));
  $('#upload').addEventListener('change', (e) => e.target.files[0] && chooseUpload(e.target.files[0]));
  let t;
  $('#pick-q').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => renderPicker(e.target.value), 120); });

  $('#levels').addEventListener('click', (e) => {
    const b = e.target.closest('.level');
    if (b) start(Number(b.dataset.n));
  });
  $('#board').addEventListener('click', (e) => {
    const tile = e.target.closest('.tile');
    if (tile) onTile(Number(tile.dataset.t));
  });
  document.addEventListener('keydown', onKey);
  $('#toggle-num').addEventListener('click', (e) => {
    const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
    e.currentTarget.setAttribute('aria-pressed', String(on));
    $('#board').classList.toggle('hide-num', !on);
    store.set('puzzle:showNum', on);
  });
  const peek = $('#peek');
  const setPeek = (on) => $('#board').classList.toggle('peek', on);
  peek.addEventListener('pointerdown', () => setPeek(true));
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) peek.addEventListener(ev, () => setPeek(false));
  peek.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') setPeek(true); });
  peek.addEventListener('keyup', () => setPeek(false));
  $('#restart').addEventListener('click', () => start(n));
  $('#back').addEventListener('click', toMenu);
  $('#again').addEventListener('click', () => { $('#result').close(); start(n); });
  $('#to-menu').addEventListener('click', toMenu);
}

main();
