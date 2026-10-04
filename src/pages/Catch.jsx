// 티니핑을 캐치! — 구멍에서 쏙쏙 나오는 티니핑 중 "찾는 티니핑"만 콕 잡기 (두더지 잡기 방식)
import { useEffect, useRef, useState } from 'react';
import { Timer } from 'lucide-react';
import GameShell, { GameSetup, SetupStep, pickArt } from '../components/GameShell.jsx';
import ResultDialog from '../components/ResultDialog.jsx';
import { useData, useTitle, asset, shuffle, store, confetti } from '../lib/data.js';
import { useFx } from '../lib/fx.jsx';
import { josa } from '../lib/korean.js';

const HOLES = 9;
const SECONDS = 30;
const SPEEDS = [
  { key: 'slow', name: '천천히', show: 1700, every: 900, desc: '처음이라면' },
  { key: 'normal', name: '보통', show: 1200, every: 700, desc: '조금 빨라요' },
  { key: 'fast', name: '빠르게', show: 850, every: 520, desc: '눈 크게 뜨고!' },
];
const bestKey = (speed) => `catch:best:${speed}`;

export default function Catch() {
  useTitle('티니핑을 캐치!');
  const { data } = useData();
  const [fx, soundOn, toggleSound] = useFx();
  const [speed, setSpeed] = useState(null);
  const [target, setTarget] = useState(null);
  const [holes, setHoles] = useState(() => Array(HOLES).fill(null)); // { item, key, state: 'up'|'caught'|'miss' }
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(SECONDS);
  const [result, setResult] = useState(null);
  const pool = useRef([]);
  const seq = useRef(0);

  const playing = speed && left > 0 && !result;

  const start = (sp) => {
    // 아이들이 알아보기 쉬운 로열·레전드 위주로 8마리를 골라 쓴다
    const known = data.items.filter((i) => i.grade === '로열' || i.grade === '레전드');
    pool.current = shuffle(known.length >= 8 ? known : data.items).slice(0, 8);
    setTarget(pool.current[0]);
    setHoles(Array(HOLES).fill(null));
    setScore(0); setLeft(SECONDS); setResult(null); setSpeed(sp);
    fx.voice('start');
  };

  // 남은 시간
  useEffect(() => {
    if (!playing) return undefined;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [playing, left]);

  // 티니핑 등장: 빈 구멍 하나에 잠깐 나타났다 들어간다 (찾는 티니핑이 40% 확률)
  useEffect(() => {
    if (!playing) return undefined;
    const t = setInterval(() => {
      setHoles((hs) => {
        const empty = hs.map((h, i) => (h ? -1 : i)).filter((i) => i >= 0);
        if (!empty.length) return hs;
        const at = empty[Math.floor(Math.random() * empty.length)];
        const others = pool.current.filter((p) => p.id !== target.id);
        const item = Math.random() < 0.4 ? target : others[Math.floor(Math.random() * others.length)];
        const key = seq.current++;
        // 시간이 지나면 쏙 내려갔다가(down) 사라진다
        setTimeout(() => setHoles((cur) => cur.map((h) => (h?.key === key && h.state === 'up' ? { ...h, state: 'down' } : h))), speed.show);
        setTimeout(() => setHoles((cur) => cur.map((h) => (h?.key === key && h.state === 'down' ? null : h))), speed.show + 220);
        return hs.map((h, i) => (i === at ? { item, key, state: 'up' } : h));
      });
    }, speed.every);
    return () => clearInterval(t);
  }, [playing, speed, target]);

  const tap = (i) => {
    const h = holes[i];
    if (!playing || !h || h.state !== 'up') return;
    const ok = h.item.id === target.id;
    fx.play(ok ? 'pop' : 'bad');
    if (ok) {
      const n = score + 1;
      setScore(n);
      // 5마리 잡을 때마다 찾는 티니핑이 바뀐다
      if (n % 5 === 0) {
        const next = pool.current[(n / 5) % pool.current.length];
        setTimeout(() => setTarget(next), 300);
        fx.play('good');
      }
    }
    setHoles((hs) => hs.map((x, k) => (k === i ? { ...x, state: ok ? 'caught' : 'miss' } : x)));
    setTimeout(() => setHoles((hs) => hs.map((x, k) => (k === i && x?.key === h.key ? null : x))), 380);
  };

  // 끝
  useEffect(() => {
    if (!speed || left > 0 || result) return;
    const isBest = score > (store.get(bestKey(speed.key)) ?? -1);
    if (isBest) store.set(bestKey(speed.key), score);
    const stars = score >= 15 ? 3 : score >= 9 ? 2 : 1;
    confetti(); fx.play('win'); fx.voice('win');
    setResult({ stars, isBest, text: `${SECONDS}초 동안 티니핑을 ${score}마리 캐치했어요!` });
  }, [left]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <p className="empty">불러오는 중…</p>;

  if (!speed) {
    return (
      <GameSetup art={pickArt(data.items, 'happying')} title="티니핑을 캐치!" desc={`쏙쏙 나오는 티니핑 중에서 찾는 티니핑만 콕! ${SECONDS}초 동안 몇 마리 잡을 수 있을까요?`}>
        <SetupStep n="1" title="빠르기를 골라 시작해요">
          <div className="choice-grid three">
            {SPEEDS.map((sp) => {
              const best = store.get(bestKey(sp.key));
              return (
                <button key={sp.key} type="button" className="choice start" onClick={() => start(sp)}>
                  <strong>{sp.name}</strong>
                  <small>{sp.desc}</small>
                  <small className="best">{best !== null ? `최고 ${best}마리` : '첫 도전!'}</small>
                </button>
              );
            })}
          </div>
        </SetupStep>
      </GameSetup>
    );
  }

  return (
    <GameShell title="티니핑을 캐치!" score={score} sound={{ on: soundOn, toggle: toggleSound }} onExit={() => setSpeed(null)}>
      <div className="catch-stage">
        <div className="catch-target">
          <img src={asset(target.thumb)} alt="" draggable="false" />
          <div>
            <small>찾는 티니핑</small>
            <strong>{josa(target.nameKo, '을/를')} 잡아요!</strong>
          </div>
          <span className={`catch-time${left <= 5 ? ' danger' : ''}`} aria-label={`남은 시간 ${left}초`}><Timer size={20} aria-hidden="true" />{left}</span>
        </div>
        <div className="catch-field">
          {holes.map((h, i) => (
            <button key={i} type="button" className="hole" onPointerDown={() => tap(i)} aria-label={h ? h.item.nameKo : '빈 구멍'}>
              {/* 뒤에서 앞으로: 흙 둔덕 → 구멍 속 → (캐릭터 창) → 앞쪽 흙 테두리. 창 아래쪽이 구멍 가운데라 몸이 구멍 속에서 올라온다 */}
              <span className="mound" aria-hidden="true" />
              <span className="pit" aria-hidden="true" />
              <span className="pop-window" aria-hidden="true">
                {h && (
                  <span className={`popper ${h.state}`}>
                    <img src={asset(h.item.thumb)} alt="" draggable="false" />
                  </span>
                )}
              </span>
              <span className="lip" aria-hidden="true" />
              {h?.state === 'caught' && <span className="catch-burst" aria-hidden="true" />}
            </button>
          ))}
        </div>
      </div>
      <ResultDialog result={result} title="시간 끝!" onAgain={() => start(speed)} onMenu={() => setSpeed(null)} menuLabel="빠르기 바꾸기" />
    </GameShell>
  );
}
