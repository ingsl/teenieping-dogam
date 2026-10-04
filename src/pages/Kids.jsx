// 유아용 게임 (3~6세): 큰 터치 영역, 실패 없음(틀리면 다시), 이름을 소리로 읽어줌
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useData, useTitle, asset, shuffle, confetti } from '../lib/data.js';
import { useFx, SoundToggle } from '../lib/fx.jsx';
import NotFound from './NotFound.jsx';

export const KIDS_GAMES = [
  { key: 'shadow', emoji: '🌑', name: '그림자 찾기', desc: '그림자와 같은 티니핑을 찾아요' },
  { key: 'different', emoji: '🔍', name: '다른 하나 찾기', desc: '혼자 다른 티니핑을 콕!' },
  { key: 'count', emoji: '🔢', name: '몇 마리일까?', desc: '티니핑이 몇 마리인지 세어 봐요' },
  { key: 'bubbles', emoji: '🫧', name: '비눗방울 톡톡', desc: '방울 속 티니핑을 터뜨려요' },
];

const COUNT_WORDS = ['', '한 마리', '두 마리', '세 마리', '네 마리', '다섯 마리'];
const CHEERS = ['잘했어요!', '최고예요!', '딩동댕!', '멋져요!', '맞았어요!'];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function Shell({ game, stars, fx, soundOn, toggleSound, children }) {
  return (
    <section className="kids">
      <div className="hud kids-hud">
        <Link className="btn ghost" to="/games">◀ 게임</Link>
        <div className="kids-title">{game.emoji} {game.name}</div>
        <div className="actions">
          <span className="kids-stars" aria-label={`별 ${stars}개`}>⭐ {stars}</span>
          <SoundToggle on={soundOn} toggle={toggleSound} />
        </div>
      </div>
      {children}
    </section>
  );
}

/** 맞힐 때마다 별 +1, 5개마다 폭죽 */
function useStars(fx) {
  const [stars, setStars] = useState(0);
  useEffect(() => {
    if (stars > 0 && stars % 5 === 0) { confetti(60); fx.play('win'); }
  }, [stars]); // eslint-disable-line react-hooks/exhaustive-deps
  const add = useCallback(() => setStars((s) => s + 1), []);
  return [stars, add];
}

/** 문제형 놀이 공통: 맞히면 칭찬 → 잠시 뒤 다음 문제, 틀리면 흔들고 다시 */
function useRound(make, fx, addStar) {
  const [round, setRound] = useState(() => make());
  const [solved, setSolved] = useState(false);
  const [wrong, setWrong] = useState(null);
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  const right = (sayText) => {
    if (solved) return;
    setSolved(true);
    fx.play('good');
    fx.say(sayText);
    addStar();
    timer.current = setTimeout(() => { setRound(make()); setSolved(false); }, 1600);
  };
  const miss = (id) => {
    if (solved) return;
    fx.play('bad');
    setWrong(id);
    setTimeout(() => setWrong(null), 450);
  };
  return { round, solved, wrong, right, miss };
}

function Shadow({ items, fx, addStar }) {
  const make = useCallback(() => {
    const [a, b] = shuffle(items);
    return { answer: a, options: shuffle([a, b]) };
  }, [items]);
  const { round, solved, wrong, right, miss } = useRound(make, fx, addStar);
  useEffect(() => { fx.say('그림자 주인은 누구일까?'); }, [round]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <p className="kids-ask">{solved ? `${round.answer.nameKo}! ${pick(CHEERS)}` : '그림자 주인은 누구일까?'}</p>
      <div className={`kids-shadow${solved ? ' revealed' : ''}`}><img src={asset(round.answer.image)} alt="그림자" draggable="false" /></div>
      <div className="kids-options two">
        {round.options.map((o) => (
          <button key={o.id} type="button" className={`kids-tile${wrong === o.id ? ' shake' : ''}${solved && o.id === round.answer.id ? ' correct' : ''}`}
            onClick={() => (o.id === round.answer.id ? right(o.nameKo) : miss(o.id))} aria-label={o.nameKo}>
            <img src={asset(o.thumb)} alt="" draggable="false" />
          </button>
        ))}
      </div>
    </>
  );
}

function Different({ items, fx, addStar }) {
  const make = useCallback(() => {
    const [same, odd] = shuffle(items);
    const tiles = shuffle([{ k: 0, it: same }, { k: 1, it: same }, { k: 2, it: same }, { k: 3, it: odd, odd: true }]);
    return { odd, tiles };
  }, [items]);
  const { round, solved, wrong, right, miss } = useRound(make, fx, addStar);
  useEffect(() => { fx.say('혼자 다른 친구를 찾아봐!'); }, [round]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <p className="kids-ask">{solved ? `${round.odd.nameKo}! ${pick(CHEERS)}` : '혼자 다른 친구는 누구?'}</p>
      <div className="kids-options four">
        {round.tiles.map((t) => (
          <button key={t.k} type="button" className={`kids-tile${wrong === t.k ? ' shake' : ''}${solved && t.odd ? ' correct' : ''}`}
            onClick={() => (t.odd ? right(t.it.nameKo) : miss(t.k))} aria-label={t.it.nameKo}>
            <img src={asset(t.it.thumb)} alt="" draggable="false" />
          </button>
        ))}
      </div>
    </>
  );
}

function Count({ items, fx, addStar }) {
  const make = useCallback(() => {
    const it = items[Math.floor(Math.random() * items.length)];
    const n = 1 + Math.floor(Math.random() * 5);
    // 겹치지 않게 3x2 칸 중 n곳에 배치
    const spots = shuffle([0, 1, 2, 3, 4, 5]).slice(0, n);
    return { it, n, spots };
  }, [items]);
  const { round, solved, wrong, right, miss } = useRound(make, fx, addStar);
  useEffect(() => { fx.say(`${round.it.nameKo}가 몇 마리 있을까?`); }, [round]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <p className="kids-ask">{solved ? `${COUNT_WORDS[round.n]}! ${pick(CHEERS)}` : `${round.it.nameKo}가 몇 마리 있을까?`}</p>
      <div className="kids-count-field">
        {[0, 1, 2, 3, 4, 5].map((s) => (
          <div key={s} className="spot">{round.spots.includes(s) && <img src={asset(round.it.thumb)} alt="" draggable="false" />}</div>
        ))}
      </div>
      <div className="kids-numbers">
        {[1, 2, 3, 4, 5].map((k) => (
          <button key={k} type="button" className={`kids-number${wrong === k ? ' shake' : ''}${solved && k === round.n ? ' correct' : ''}`}
            onClick={() => (k === round.n ? right(COUNT_WORDS[k]) : miss(k))} aria-label={`${k}`}>
            <span className="num">{k}</span>
            <span className="dots" aria-hidden="true">{'●'.repeat(k)}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function Bubbles({ items, fx, addStar }) {
  const [bubbles, setBubbles] = useState([]);
  const seq = useRef(0);
  useEffect(() => {
    fx.say('비눗방울을 톡톡 터뜨려 봐!');
    const spawn = () => {
      const it = items[Math.floor(Math.random() * items.length)];
      const id = seq.current++;
      setBubbles((b) => [...b.slice(-11), { id, it, left: 5 + Math.random() * 75, size: 90 + Math.random() * 50, dur: 6 + Math.random() * 3 }]);
    };
    spawn();
    const t = setInterval(spawn, 1100);
    return () => clearInterval(t);
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps
  const pop = (b) => {
    fx.play('pop');
    if (Math.random() < 0.35) fx.say(b.it.nameKo);
    addStar();
    setBubbles((list) => list.map((x) => (x.id === b.id ? { ...x, popped: true } : x)));
    setTimeout(() => setBubbles((list) => list.filter((x) => x.id !== b.id)), 350);
  };
  return (
    <>
      <p className="kids-ask">방울을 톡! 터뜨려 봐요</p>
      <div className="bubble-field">
        {bubbles.map((b) => (
          <button key={b.id} type="button" className={`bubble${b.popped ? ' popped' : ''}`} aria-label={`${b.it.nameKo} 방울`}
            style={{ left: `${b.left}%`, width: b.size, height: b.size, animationDuration: `${b.dur}s` }}
            onPointerDown={() => !b.popped && pop(b)}
            onAnimationEnd={(e) => e.animationName === 'rise' && setBubbles((list) => list.filter((x) => x.id !== b.id))}>
            <img src={asset(b.it.thumb)} alt="" draggable="false" />
          </button>
        ))}
      </div>
    </>
  );
}

const GAMES = { shadow: Shadow, different: Different, count: Count, bubbles: Bubbles };

export default function Kids() {
  const { game: key } = useParams();
  const game = KIDS_GAMES.find((g) => g.key === key);
  useTitle(game?.name || '');
  const { data } = useData();
  const [fx, soundOn, toggleSound] = useFx();
  const [stars, addStar] = useStars(fx);
  // 아이들이 알아보기 쉬운 로열·레전드를 먼저, 나머지는 섞어서
  const items = useMemo(() => {
    const all = (data?.items || []).filter((i) => i.thumb);
    return [...all.filter((i) => i.grade === '로열' || i.grade === '레전드'), ...shuffle(all)].filter((i, k, a) => a.indexOf(i) === k).slice(0, 60);
  }, [data]);

  if (!game) return <NotFound />;
  if (!data) return <p className="empty">불러오는 중…</p>;
  const Game = GAMES[key];
  return (
    <Shell game={game} stars={stars} fx={fx} soundOn={soundOn} toggleSound={toggleSound}>
      <Game key={key} items={items} fx={fx} addStar={addStar} />
    </Shell>
  );
}
