// 퍼즐 게임: 바꾸기(swap) / 슬라이드(slide) × 난이도 3~6
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ResultDialog from '../components/ResultDialog.jsx';
import { useData, useTitle, useTimer, asset, shuffle, store, formatTime, confetti, matches, characterCanvas } from '../lib/data.js';
import { useFx, SoundToggle } from '../lib/fx.jsx';

const LEVELS = [
  { n: 3, name: '쉬움' },
  { n: 4, name: '보통' },
  { n: 5, name: '어려움' },
  { n: 6, name: '고수' },
];
const bestKey = (mode, n) => `puzzle:best:${mode}:${n}`;

function neighbors(cell, n) {
  const r = Math.floor(cell / n), c = cell % n, out = [];
  if (r > 0) out.push(cell - n);
  if (r < n - 1) out.push(cell + n);
  if (c > 0) out.push(cell - 1);
  if (c < n - 1) out.push(cell + 1);
  return out;
}
const solvedOf = (pos) => pos.every((p, t) => p === t);

/** pos[tile] = cell. 슬라이드는 완성 상태에서 빈칸을 무작위로 움직여 섞으므로 항상 풀 수 있다. */
function scramble(mode, n) {
  const cells = n * n;
  if (mode === 'swap') {
    let pos;
    do { pos = shuffle([...Array(cells).keys()]); } while (solvedOf(pos));
    return pos;
  }
  const at = [...Array(cells).keys()]; // at[cell] = tile, 빈칸 tile = cells-1
  let empty = cells - 1, prev = -1;
  for (let k = 0; k < cells * 30 || at.every((t, c) => t === c); k++) {
    const nb = neighbors(empty, n).filter((c) => c !== prev);
    const c = nb[Math.floor(Math.random() * nb.length)];
    [at[empty], at[c]] = [at[c], at[empty]];
    prev = empty;
    empty = c;
  }
  const pos = [];
  at.forEach((t, c) => { pos[t] = c; });
  return pos;
}

export default function Puzzle() {
  useTitle('퍼즐 게임');
  const { data } = useData();
  const [mode, setMode] = useState(() => store.get('puzzle:mode', 'swap'));
  const [item, setItem] = useState(null);
  const [upload, setUpload] = useState(null); // 업로드 사진 data URL
  const [image, setImage] = useState('');
  const [q, setQ] = useState('');
  const [n, setN] = useState(null);
  const [pos, setPos] = useState([]);
  const [selected, setSelected] = useState(null);
  const [moves, setMoves] = useState(0);
  const [round, setRound] = useState(0);
  const [showNum, setShowNum] = useState(() => store.get('puzzle:showNum', true));
  const [peek, setPeek] = useState(false);
  const [result, setResult] = useState(null);
  const [fx, soundOn, toggleSound] = useFx();
  const empty = mode === 'slide' && n ? n * n - 1 : -1;
  const solved = n !== null && pos.length > 0 && solvedOf(pos);
  const seconds = useTimer(n !== null && moves > 0 && !solved, round);

  const withImage = useMemo(() => (data?.items || []).filter((i) => i.image), [data]);
  const randomItem = useCallback(() => withImage[Math.floor(Math.random() * withImage.length)], [withImage]);

  // 처음 들어오면 지난번 그림(없으면 아무나)
  useEffect(() => {
    if (data && !item) setItem(data.items.find((i) => i.id === store.get('puzzle:item')) || randomItem());
  }, [data, item, randomItem]);

  useEffect(() => {
    if (upload) { setImage(upload); return; }
    if (!item) return;
    store.set('puzzle:item', item.id);
    characterCanvas(item).then((c) => setImage(c.toDataURL('image/png')));
  }, [item, upload]);

  const onUpload = (file) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const img = new Image();
      img.src = reader.result;
      await img.decode();
      const s = Math.min(img.width, img.height);
      const c = document.createElement('canvas');
      c.width = c.height = 720;
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 720, 720);
      setUpload(c.toDataURL('image/jpeg', 0.9));
    };
    reader.readAsDataURL(file);
  };

  const start = (size) => {
    setN(size); setPos(scramble(mode, size)); setMoves(0); setSelected(null); setResult(null);
    setRound((r) => r + 1);
  };

  const move = useCallback((t) => {
    if (solved || n === null) return;
    if (mode === 'swap') {
      if (selected === null) { setSelected(t); fx.play('select'); return; }
      if (selected !== t) {
        fx.play('slide');
        setPos((p) => { const next = [...p]; [next[selected], next[t]] = [next[t], next[selected]]; return next; });
        setMoves((m) => m + 1);
      }
      setSelected(null);
      return;
    }
    // 슬라이드: 빈칸과 같은 행/열이면 사이 조각을 한꺼번에 민다
    const cell = pos[t], e = pos[empty];
    const sameRow = Math.floor(cell / n) === Math.floor(e / n), sameCol = cell % n === e % n;
    if (t === empty || (!sameRow && !sameCol)) return;
    const next = [...pos];
    const tileAt = (c) => next.findIndex((x) => x === c);
    const step = sameRow ? (cell < e ? -1 : 1) : (cell < e ? -n : n);
    for (let c = e; c !== cell; c += step) next[tileAt(c + step)] = c;
    next[empty] = cell;
    setPos(next);
    setMoves((m) => m + 1);
    fx.play('slide'); // 조각 이동 "스윽~"
  }, [solved, n, mode, selected, empty, pos, fx]);

  // 슬라이드: 방향으로 빈칸 옆 조각을 민다 (dir = 빈칸 기준으로 끌어올 조각의 칸 차이)
  const slideFrom = useCallback((dir) => {
    const e0 = pos[empty], from = e0 + dir;
    if (from < 0 || from >= n * n || (Math.abs(dir) === 1 && Math.floor(from / n) !== Math.floor(e0 / n))) return false;
    move(pos.findIndex((c) => c === from));
    return true;
  }, [pos, empty, n, move]);

  // 키보드 화살표 (슬라이드)
  useEffect(() => {
    if (n === null || mode !== 'slide') return undefined;
    const onKey = (e) => {
      const dir = { ArrowUp: n, ArrowDown: -n, ArrowLeft: 1, ArrowRight: -1 }[e.key];
      if (dir && slideFrom(dir)) e.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [n, mode, slideFrom]);

  // 손가락 스와이프 (슬라이드): 밀고 싶은 방향으로 쓸면 빈칸 옆 조각이 그쪽으로 이동
  const swipe = useRef(null);
  const onPointerDown = (e) => { swipe.current = { x: e.clientX, y: e.clientY, used: false }; };
  const onPointerUp = (e) => {
    const s = swipe.current;
    if (!s || mode !== 'slide') return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return; // 탭은 click 으로 처리
    s.used = true;
    if (Math.abs(dx) > Math.abs(dy)) slideFrom(dx < 0 ? 1 : -1);
    else slideFrom(dy < 0 ? n : -n);
  };
  const onTileClick = (t) => {
    if (swipe.current?.used) { swipe.current = null; return; } // 스와이프 끝의 클릭은 무시
    move(t);
  };

  useEffect(() => {
    if (!solved || result) return undefined;
    const par = mode === 'swap' ? n * n : n * n * n * 1.6;
    const stars = moves <= par ? 3 : moves <= par * 1.8 ? 2 : 1;
    const key = bestKey(mode, n);
    const prev = store.get(key);
    const isBest = !prev || moves < prev.moves || (moves === prev.moves && seconds < prev.time);
    if (isBest) store.set(key, { moves, time: seconds });
    const t = setTimeout(() => {
      confetti();
      fx.play('win');
      setResult({ stars, isBest, text: `${n}×${n} ${mode === 'swap' ? '바꾸기' : '슬라이드'} · ${moves}번 · ${formatTime(seconds)}` });
    }, 700);
    return () => clearTimeout(t);
  }, [solved]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <p className="empty">불러오는 중…</p>;

  if (n === null) {
    const list = data.items.filter((i) => matches(i, q));
    return (
      <section>
        <div className="hero">
          <h1>🧩 퍼즐 게임</h1>
          <p>조각을 맞춰 티니핑 그림을 완성해요.</p>
        </div>
        <div className="section">
          <h2>1. 놀이 방법</h2>
          <div className="filter-row" role="radiogroup" aria-label="놀이 방법">
            {[['swap', '🔄 바꾸기 — 두 조각을 눌러 자리 바꾸기'], ['slide', '⬜ 슬라이드 — 빈칸으로 밀기']].map(([m, label]) => (
              <button key={m} type="button" className="pill" aria-pressed={mode === m} onClick={() => { setMode(m); store.set('puzzle:mode', m); }}>{label}</button>
            ))}
          </div>
        </div>
        <div className="section">
          <h2>2. 그림 고르기</h2>
          <div className="option-row">
            <div className="preview-thumb" role="img" aria-label="선택한 그림 미리보기" style={{ backgroundImage: image ? `url(${image})` : undefined }} />
            <div>
              <div className="picked-name">{upload ? '내 사진' : item?.nameKo}</div>
              <div className="option-row">
                <button className="btn ghost" type="button" onClick={() => { setUpload(null); setItem(randomItem()); }}>🎲 아무나</button>
                <label className="btn ghost" htmlFor="upload">📷 내 사진으로</label>
                <input id="upload" type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files[0] && onUpload(e.target.files[0])} />
              </div>
            </div>
          </div>
          <label className="sr-only" htmlFor="pick-q">티니핑 찾기</label>
          <input id="pick-q" className="search" type="search" placeholder="🔍 티니핑 찾기" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="picker">
            {list.map((i) => (
              <button key={i.id} type="button" aria-pressed={!upload && item?.id === i.id} onClick={() => { setUpload(null); setItem(i); }}>
                <img src={asset(i.thumb)} alt="" loading="lazy" />{i.nameKo}
              </button>
            ))}
          </div>
        </div>
        <div className="section">
          <h2>3. 난이도</h2>
          <div className="level-grid">
            {LEVELS.map((lv) => {
              const b = store.get(bestKey(mode, lv.n));
              return (
                <button key={lv.n} className="level" type="button" disabled={!image} onClick={() => start(lv.n)}>
                  <div className="size">{lv.n}×{lv.n}</div>
                  <div><strong>{lv.name}</strong></div>
                  <div className="desc">{lv.n * lv.n}조각</div>
                  <div className="best">{b ? `최고 ${b.moves}번 · ${formatTime(b.time)}` : '아직 기록 없음'}</div>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="hud">
        <div className="stats">
          <span>⏱ {formatTime(seconds)}</span>
          <span>👆 {moves}번</span>
        </div>
        <div className="actions">
          <button className="btn ghost" type="button" aria-pressed={showNum} onClick={() => { setShowNum(!showNum); store.set('puzzle:showNum', !showNum); }}>🔢 번호</button>
          <button className="btn ghost" type="button" onPointerDown={() => setPeek(true)} onPointerUp={() => setPeek(false)} onPointerLeave={() => setPeek(false)}
            onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && setPeek(true)} onKeyUp={() => setPeek(false)}>👀 정답 보기</button>
          <button className="btn ghost" type="button" onClick={() => start(n)}>다시 섞기</button>
          <button className="btn ghost" type="button" onClick={() => setN(null)}>설정</button>
          <SoundToggle on={soundOn} toggle={toggleSound} />
        </div>
      </div>
      <div className="puzzle-wrap">
        <div className={['puzzle-board', !showNum && 'hide-num', solved && 'solved', peek && 'peek'].filter(Boolean).join(' ')} style={{ '--n': n }} aria-label="퍼즐판"
          onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
          {pos.map((cell, t) => (t === empty ? null : (
            <button key={t} type="button" onClick={() => onTileClick(t)}
              className={['tile', selected === t && 'selected', mode === 'swap' && cell === t && 'correct-hint'].filter(Boolean).join(' ')}
              aria-label={`${t + 1}번 조각, ${Math.floor(cell / n) + 1}행 ${(cell % n) + 1}열`}
              style={{
                left: `${(cell % n) * (100 / n)}%`, top: `${Math.floor(cell / n) * (100 / n)}%`,
                backgroundImage: `url(${image})`,
                backgroundPosition: `${(t % n) * (100 / (n - 1))}% ${Math.floor(t / n) * (100 / (n - 1))}%`,
              }}>
              <span className="num">{t + 1}</span>
            </button>
          )))}
          <div className="full" style={{ backgroundImage: `url(${image})` }} />
        </div>
        <p className="hint">
          {mode === 'swap' ? '두 조각을 차례로 누르면 자리가 바뀌어요. 제자리에 온 조각은 초록 테두리!' : '빈칸 옆(같은 줄) 조각을 누르거나, 손가락으로 쓱 밀어요. 키보드 화살표도 돼요.'}
        </p>
      </div>
      <ResultDialog result={result} title="완성!" onAgain={() => start(n)} onMenu={() => setN(null)} menuLabel="다른 그림·난이도" />
    </section>
  );
}
