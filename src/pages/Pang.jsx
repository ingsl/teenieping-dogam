// 티니핑 팡팡 — 같은 티니핑 3개 이상을 한 줄로 맞추면 팡! (60초 타임어택)
import { useCallback, useEffect, useRef, useState } from 'react';
import { Timer } from 'lucide-react';
import GameShell, { GameSetup, SetupStep, pickArt } from '../components/GameShell.jsx';
import ResultDialog from '../components/ResultDialog.jsx';
import { useData, useTitle, asset, shuffle, store, confetti } from '../lib/data.js';
import { useFx } from '../lib/fx.jsx';

const N = 7;
const SECONDS = 60;
const LEVELS = [
  { key: 'easy', name: '쉬움', kinds: 4, desc: '티니핑 4종류' },
  { key: 'normal', name: '보통', kinds: 5, desc: '티니핑 5종류' },
  { key: 'hard', name: '어려움', kinds: 6, desc: '티니핑 6종류' },
];
const bestKey = (lv) => `pang:best:${lv}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** #RRGGBB → 색상환 각도 (0~360) */
function hue(hex = '') {
  const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return null;
  const [rr, gg, bb] = m.slice(1).map((x) => parseInt(x, 16) / 255);
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb), d = max - min;
  if (d < 0.08) return null; // 회색·흰색 계열은 구별이 어려워 제외
  const h = max === rr ? ((gg - bb) / d) % 6 : max === gg ? (bb - rr) / d + 2 : (rr - gg) / d + 4;
  return (h * 60 + 360) % 360;
}

/** 대표색이 서로 최대한 다른 티니핑 kinds 마리 (한눈에 구별되게) */
function pickDistinct(items, kinds) {
  const pool = shuffle(items.map((i) => ({ i, h: hue(i.colorHex) })).filter((x) => x.h !== null && x.i.thumb));
  const gap = (a, b) => { const d = Math.abs(a - b); return Math.min(d, 360 - d); };
  const picked = [];
  for (let need = 360 / kinds * 0.8; picked.length < kinds && need > 5; need *= 0.8) {
    for (const x of pool) {
      if (picked.length >= kinds) break;
      if (!picked.includes(x) && picked.every((p) => gap(p.h, x.h) >= need)) picked.push(x);
    }
  }
  return picked.map((x) => x.i);
}

let seq = 0;
const newTile = (kind, r, c, fresh = false) => ({ id: seq++, kind, r, c, state: fresh ? 'new' : '' });

/** 3개 이상 이어진 칸들 (가로·세로) */
function findMatches(g) {
  const hit = new Set();
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const k = g[r][c]?.kind;
      if (k === undefined) continue;
      if (c + 2 < N && g[r][c + 1]?.kind === k && g[r][c + 2]?.kind === k) {
        for (let x = c; x < N && g[r][x]?.kind === k; x++) hit.add(g[r][x]);
      }
      if (r + 2 < N && g[r + 1][c]?.kind === k && g[r + 2][c]?.kind === k) {
        for (let y = r; y < N && g[y][c]?.kind === k; y++) hit.add(g[y][c]);
      }
    }
  }
  return hit;
}

/** 바꿔서 맞출 수 있는 한 수 (힌트·막힘 판정용) */
function findMove(g) {
  const swap = (a, b) => { const t = g[a.r][a.c]; g[a.r][a.c] = g[b.r][b.c]; g[b.r][b.c] = t; };
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const r2 = r + dr, c2 = c + dc;
        if (r2 >= N || c2 >= N) continue;
        swap({ r, c }, { r: r2, c: c2 });
        const ok = findMatches(g).size > 0;
        swap({ r, c }, { r: r2, c: c2 });
        if (ok) return [g[r][c], g[r2][c2]];
      }
    }
  }
  return null;
}

/** 처음부터 맞춰진 줄이 없고, 둘 수 있는 수는 있는 판 */
function makeGrid(kinds) {
  for (;;) {
    const g = Array.from({ length: N }, () => Array(N).fill(null));
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        let k;
        do { k = Math.floor(Math.random() * kinds); }
        while ((c >= 2 && g[r][c - 1].kind === k && g[r][c - 2].kind === k) || (r >= 2 && g[r - 1][c].kind === k && g[r - 2][c].kind === k));
        g[r][c] = newTile(k, r, c);
      }
    }
    if (findMove(g)) return g;
  }
}

export default function Pang() {
  useTitle('티니핑 팡팡');
  const { data } = useData();
  const [fx, soundOn, toggleSound] = useFx();
  const [level, setLevel] = useState(null);
  const [chars, setChars] = useState([]);
  const [tiles, setTiles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [left, setLeft] = useState(SECONDS);
  const [hint, setHint] = useState([]);
  const [result, setResult] = useState(null);
  const grid = useRef(null);
  const busy = useRef(false);
  const idle = useRef();
  const swipe = useRef(null);
  const scoreRef = useRef(0);

  const render = () => setTiles(grid.current.flat().filter(Boolean).map((t) => ({ ...t })));
  const playing = level && left > 0 && !result;

  const start = (lv) => {
    // 로열·레전드 중 대표색이 서로 다른 티니핑 (모자라면 전체에서)
    const known = data.items.filter((i) => i.grade === '로열' || i.grade === '레전드');
    let picked = pickDistinct(known, lv.kinds);
    if (picked.length < lv.kinds) picked = pickDistinct(data.items, lv.kinds);
    setChars(picked);
    grid.current = makeGrid(lv.kinds);
    scoreRef.current = 0;
    setScore(0); setCombo(0); setLeft(SECONDS); setResult(null); setSelected(null); setHint([]);
    busy.current = false;
    setLevel(lv);
    render();
  };

  // 남은 시간
  useEffect(() => {
    if (!playing) return undefined;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [playing, left]);

  // 5초 동안 가만히 있으면 힌트
  const armHint = useCallback(() => {
    clearTimeout(idle.current);
    setHint([]);
    idle.current = setTimeout(() => {
      const m = grid.current && findMove(grid.current);
      if (m) setHint(m.map((t) => t.id));
    }, 5000);
  }, []);
  useEffect(() => { if (playing) armHint(); return () => clearTimeout(idle.current); }, [playing, armHint]);

  /** 맞춘 줄 터뜨리기 → 떨어뜨리기 → 채우기, 연쇄가 끝날 때까지 */
  const resolve = async () => {
    let chain = 0;
    for (;;) {
      const hit = findMatches(grid.current);
      if (!hit.size) break;
      chain++;
      setCombo(chain);
      fx.play(chain > 1 ? 'good' : 'pop');
      for (const t of hit) t.state = 'pop';
      render();
      await wait(230);
      const gained = hit.size * 10 * chain;
      scoreRef.current += gained;
      setScore(scoreRef.current);
      for (const t of hit) grid.current[t.r][t.c] = null;
      // 중력: 아래로 내리고 위에 새로 채움
      for (let c = 0; c < N; c++) {
        let write = N - 1;
        for (let r = N - 1; r >= 0; r--) {
          const t = grid.current[r][c];
          if (t) { grid.current[r][c] = null; grid.current[write][c] = t; t.r = write; t.state = ''; write--; }
        }
        for (let r = write; r >= 0; r--) grid.current[r][c] = newTile(Math.floor(Math.random() * level.kinds), r, c, true);
      }
      render();
      await wait(280);
    }
    setTimeout(() => setCombo(0), 600);
    // 둘 곳이 없으면 새 판
    if (!findMove(grid.current)) {
      grid.current = makeGrid(level.kinds);
      render();
    }
  };

  const trySwap = async (a, b) => {
    if (busy.current) return;
    busy.current = true;
    setSelected(null);
    armHint();
    const g = grid.current;
    const swapCells = () => {
      g[a.r][a.c] = b; g[b.r][b.c] = a;
      [a.r, b.r] = [b.r, a.r];
      [a.c, b.c] = [b.c, a.c];
    };
    swapCells();
    fx.play('slide');
    render();
    await wait(180);
    if (findMatches(g).size) {
      await resolve();
    } else {
      fx.play('bad');
      swapCells();
      render();
      await wait(180);
    }
    busy.current = false;
  };

  const cellOf = (id) => grid.current.flat().find((t) => t?.id === id);
  const adjacent = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;

  const tapTile = (id) => {
    if (!playing || busy.current) return;
    const t = cellOf(id);
    if (!t) return;
    if (selected === null) { setSelected(id); fx.play('select'); return; }
    const s = cellOf(selected);
    if (s && s.id !== t.id && adjacent(s, t)) trySwap(s, t);
    else setSelected(s?.id === t.id ? null : id);
  };

  // 손가락으로 밀기: 누른 티니핑을 민 방향의 이웃과 바꾼다
  const onDown = (e, id) => { swipe.current = { x: e.clientX, y: e.clientY, id, used: false }; };
  const onUp = (e) => {
    const s = swipe.current;
    if (!s || !playing) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    s.used = true;
    const a = cellOf(s.id);
    if (!a) return;
    const [dr, dc] = Math.abs(dx) > Math.abs(dy) ? [0, dx > 0 ? 1 : -1] : [dy > 0 ? 1 : -1, 0];
    const b = grid.current[a.r + dr]?.[a.c + dc];
    if (b) trySwap(a, b);
  };
  const onClick = (id) => {
    if (swipe.current?.used) { swipe.current = null; return; }
    tapTile(id);
  };

  // 끝
  useEffect(() => {
    if (!level || left > 0 || result) return;
    clearTimeout(idle.current);
    const s = scoreRef.current;
    const isBest = s > (store.get(bestKey(level.key)) ?? -1);
    if (isBest) store.set(bestKey(level.key), s);
    const stars = s >= 2500 ? 3 : s >= 1200 ? 2 : 1;
    confetti(); fx.play('win'); fx.voice('win');
    setResult({ stars, isBest, text: `${SECONDS}초 동안 ${s.toLocaleString('ko-KR')}점을 모았어요!` });
  }, [left]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <p className="empty">불러오는 중…</p>;

  if (!level) {
    return (
      <GameSetup art={pickArt(data.items, 'chachaping')} title="티니핑 팡팡" desc={`이웃한 티니핑을 바꿔서 같은 티니핑 3개를 한 줄로! ${SECONDS}초 동안 점수를 모아요.`}>
        <SetupStep n="1" title="난이도를 골라 시작해요">
          <div className="choice-grid three">
            {LEVELS.map((lv) => {
              const best = store.get(bestKey(lv.key));
              return (
                <button key={lv.key} type="button" className="choice start" onClick={() => start(lv)}>
                  <strong>{lv.name}</strong>
                  <small>{lv.desc}</small>
                  <small className="best">{best !== null ? `최고 ${best.toLocaleString('ko-KR')}점` : '첫 도전!'}</small>
                </button>
              );
            })}
          </div>
        </SetupStep>
      </GameSetup>
    );
  }

  return (
    <GameShell title="티니핑 팡팡" score={score} sound={{ on: soundOn, toggle: toggleSound }} onExit={() => { clearTimeout(idle.current); setLevel(null); }}>
      <div className="pang-stage">
        <div className="pang-info">
          <span className={`catch-time${left <= 10 ? ' danger' : ''}`} aria-label={`남은 시간 ${left}초`}><Timer size={20} aria-hidden="true" />{left}</span>
          <div className="timebar"><i style={{ width: `${(left / SECONDS) * 100}%` }} /></div>
          <span className={`pang-combo${combo > 1 ? ' show' : ''}`} aria-live="polite">{combo > 1 ? `${combo} 콤보!` : ''}</span>
        </div>
        <div className="pang-board" style={{ '--n': N }} onPointerUp={onUp}>
          {tiles.map((t) => (
            <button key={t.id} type="button"
              className={['pang-tile', t.state, selected === t.id && 'selected', hint.includes(t.id) && 'hint'].filter(Boolean).join(' ')}
              style={{ top: `${(t.r * 100) / N}%`, left: `${(t.c * 100) / N}%`, '--k': chars[t.kind]?.colorHex }}
              onPointerDown={(e) => onDown(e, t.id)} onClick={() => onClick(t.id)}
              aria-label={chars[t.kind]?.nameKo}>
              <img src={asset(chars[t.kind]?.thumb)} alt="" draggable="false" />
            </button>
          ))}
        </div>
        <p className="hint-text">이웃한 두 티니핑을 차례로 누르거나, 손가락으로 쓱 밀어서 바꿔요.</p>
      </div>
      <ResultDialog result={result} title="시간 끝!" onAgain={() => start(level)} onMenu={() => setLevel(null)} menuLabel="난이도 바꾸기" />
    </GameShell>
  );
}
