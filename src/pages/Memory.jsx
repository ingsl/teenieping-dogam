// 메모리(카드 짝 맞추기) 게임 — 카드 앞면은 도감 카드와 같은 모양
import { useEffect, useRef, useState } from 'react';
import CharacterCard from '../components/CharacterCard.jsx';
import ResultDialog from '../components/ResultDialog.jsx';
import { useData, useTitle, useTimer, shuffle, store, formatTime, confetti } from '../lib/data.js';

const LEVELS = [
  { cols: 4, rows: 3, name: '아기', desc: '6쌍 · 처음이라면' },
  { cols: 4, rows: 4, name: '쉬움', desc: '8쌍' },
  { cols: 5, rows: 5, name: '보통', desc: '12쌍 + 보너스 칸' },
  { cols: 6, rows: 6, name: '어려움', desc: '18쌍' },
  { cols: 8, rows: 8, name: '도전', desc: '32쌍 · 고수만!' },
];
const keyOf = (lv) => `memory:best:${lv.cols}x${lv.rows}`;

function deal(items, season, pairs) {
  const ordered = [
    ...shuffle(items.filter((i) => !season || i.seasonKey === season)),
    ...shuffle(items.filter((i) => season && i.seasonKey !== season)),
  ].slice(0, pairs);
  const cards = shuffle(ordered.flatMap((item) => [{ key: item.id, item }, { key: item.id, item }]));
  return cards;
}

export default function Memory() {
  useTitle('메모리 게임');
  const { data } = useData();
  const [season, setSeason] = useState(() => store.get('memory:season', ''));
  const [level, setLevel] = useState(null);
  const [cards, setCards] = useState([]);
  const [open, setOpen] = useState([]); // 지금 뒤집혀 있는(짝 확인 중) 카드 index
  const [matched, setMatched] = useState(() => new Set());
  const [moves, setMoves] = useState(0);
  const [round, setRound] = useState(0);
  const [result, setResult] = useState(null);
  const [shake, setShake] = useState([]);
  const started = moves > 0 || open.length > 0;
  const totalPairs = level ? Math.floor((level.cols * level.rows) / 2) : 0;
  const done = level && matched.size === totalPairs * 2;
  const seconds = useTimer(Boolean(level) && started && !done, round);
  const lockRef = useRef(false);

  const start = (lv) => {
    const c = deal(data.items, season, Math.floor((lv.cols * lv.rows) / 2));
    if ((lv.cols * lv.rows) % 2) c.splice(Math.floor((lv.cols * lv.rows) / 2), 0, { free: true }); // 가운데 보너스 칸
    setLevel(lv); setCards(c); setOpen([]); setMatched(new Set()); setMoves(0); setResult(null);
    setRound((r) => r + 1);
    lockRef.current = false;
  };

  const flip = (i) => {
    if (lockRef.current || open.includes(i) || matched.has(i) || cards[i].free) return;
    if (open.length === 0) { setOpen([i]); return; }
    const [a] = open;
    setOpen([a, i]);
    setMoves((m) => m + 1);
    if (cards[a].key === cards[i].key) {
      setMatched((s) => new Set([...s, a, i]));
      setOpen([]);
    } else {
      lockRef.current = true;
      setTimeout(() => {
        setOpen([]);
        setShake([a, i]);
        lockRef.current = false;
        setTimeout(() => setShake([]), 400);
      }, 850);
    }
  };

  // 다 맞추면 결과
  useEffect(() => {
    if (!done || result) return;
    const ratio = moves / totalPairs;
    const stars = ratio <= 1.5 ? 3 : ratio <= 2.2 ? 2 : 1;
    const prev = store.get(keyOf(level));
    const isBest = !prev || moves < prev.moves || (moves === prev.moves && seconds < prev.time);
    if (isBest) store.set(keyOf(level), { moves, time: seconds });
    const t = setTimeout(() => {
      confetti();
      setResult({ stars, text: `${level.cols}×${level.rows} · ${moves}번 만에 · ${formatTime(seconds)}`, isBest });
    }, 500);
    return () => clearTimeout(t);
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <p className="empty">불러오는 중…</p>;

  if (!level) {
    const present = new Set(data.items.map((i) => i.seasonKey));
    return (
      <section>
        <div className="hero">
          <h1>🃏 메모리 게임</h1>
          <p>카드를 두 장씩 뒤집어 같은 티니핑을 찾아요.</p>
        </div>
        <div className="option-row">
          <label htmlFor="season">어떤 티니핑으로?</label>
          <select id="season" value={season} onChange={(e) => { setSeason(e.target.value); store.set('memory:season', e.target.value); }}>
            <option value="">전체 기수</option>
            {data.seasons.filter((s) => present.has(s.key)).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
        <div className="level-grid">
          {LEVELS.map((lv) => {
            const b = store.get(keyOf(lv));
            return (
              <button key={lv.name} className="level" type="button" onClick={() => start(lv)}>
                <div className="size">{lv.cols}×{lv.rows}</div>
                <div><strong>{lv.name}</strong></div>
                <div className="desc">{lv.desc}</div>
                <div className="best">{b ? `최고 ${b.moves}번 · ${formatTime(b.time)}` : '아직 기록 없음'}</div>
              </button>
            );
          })}
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
          <span>💗 {matched.size / 2}/{totalPairs}</span>
        </div>
        <div className="actions">
          <button className="btn ghost" type="button" onClick={() => start(level)}>다시 섞기</button>
          <button className="btn ghost" type="button" onClick={() => setLevel(null)}>난이도 선택</button>
        </div>
      </div>
      <div className={`memory-board${level.cols >= 8 ? ' tiny' : ''}`} style={{ '--cols': level.cols, '--rows': level.rows }} role="grid" aria-label="메모리 카드판">
        {cards.map((c, i) => {
          if (c.free) return <div key="free" className="mcard free" role="gridcell" aria-label="보너스 칸"><div className="face">🌟</div></div>;
          const up = open.includes(i) || matched.has(i);
          const cls = ['mcard', up && 'flipped', matched.has(i) && 'matched', shake.includes(i) && 'shake'].filter(Boolean).join(' ');
          return (
            <button key={`${round}-${i}`} type="button" className={cls} role="gridcell" onClick={() => flip(i)}
              aria-label={up ? `${c.item.nameKo} 카드${matched.has(i) ? ' 짝 찾음' : ''}` : `뒤집힌 카드 ${i + 1}`}>
              <div className="inner">
                <div className="face back" aria-hidden="true">♥</div>
                <div className="face front" aria-hidden="true"><CharacterCard item={c.item} compact /></div>
              </div>
            </button>
          );
        })}
      </div>
      <ResultDialog result={result} title="모두 찾았어요!" onAgain={() => start(level)} onMenu={() => setLevel(null)} menuLabel="다른 난이도" />
    </section>
  );
}
