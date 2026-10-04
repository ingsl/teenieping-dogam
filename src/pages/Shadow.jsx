// 그림자 찾기 — 티니핑을 보고, 그림자 5개 중 같은 모양을 찾기
import { useEffect, useRef, useState } from 'react';
import GameShell, { GameSetup, SetupStep, ProgressDots } from '../components/GameShell.jsx';
import ResultDialog from '../components/ResultDialog.jsx';
import { useData, useTitle, asset, shuffle, store, confetti } from '../lib/data.js';
import { useFx } from '../lib/fx.jsx';
import { josa } from '../lib/korean.js';

const ROUNDS = 10;
const CHOICES = 5;
const bestKey = (scope) => `shadow:best:${scope || 'all'}`;

function makeRounds(items, scope) {
  const pool = items.filter((i) => !scope || i.seasonKey === scope);
  return shuffle(pool).slice(0, ROUNDS).map((answer) => {
    const others = [...shuffle(pool), ...shuffle(items)].filter((i, k, a) => i.id !== answer.id && a.findIndex((x) => x.id === i.id) === k);
    return { answer, options: shuffle([answer, ...others.slice(0, CHOICES - 1)]) };
  });
}

export default function Shadow() {
  useTitle('그림자 찾기');
  const { data } = useData();
  const [fx, soundOn, toggleSound] = useFx();
  const [scope, setScope] = useState(() => store.get('shadow:scope', ''));
  const [rounds, setRounds] = useState(null);
  const [index, setIndex] = useState(0);
  const [tried, setTried] = useState([]); // 이번 문제에서 틀린 그림자 id
  const [solved, setSolved] = useState(false);
  const [results, setResults] = useState([]); // 한 번에 맞혔는지
  const [result, setResult] = useState(null);
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);

  const r = rounds?.[index];
  const score = results.filter(Boolean).length;

  const start = () => {
    clearTimeout(timer.current);
    setRounds(makeRounds(data.items, scope));
    setIndex(0); setTried([]); setSolved(false); setResults([]); setResult(null);
  };

  const pick = (o) => {
    if (solved || tried.includes(o.id)) return;
    if (o.id !== r.answer.id) {
      fx.play('bad');
      setTried((t) => [...t, o.id]);
      return;
    }
    fx.play('good');
    fx.voice('correct');
    setSolved(true);
    setResults((res) => [...res, tried.length === 0]);
    timer.current = setTimeout(() => {
      if (index + 1 >= rounds.length) return;
      setIndex((i) => i + 1); setTried([]); setSolved(false);
    }, 1400);
  };

  useEffect(() => {
    if (!rounds || results.length < rounds.length) return undefined;
    const t = setTimeout(() => {
      const stars = score >= 9 ? 3 : score >= 6 ? 2 : 1;
      const isBest = score > (store.get(bestKey(scope)) ?? -1);
      if (isBest) store.set(bestKey(scope), score);
      confetti(); fx.play('win'); fx.voice('win');
      setResult({ stars, isBest, text: `${rounds.length}문제 중 ${score}문제를 한 번에 찾았어요!` });
    }, 900);
    return () => clearTimeout(t);
  }, [results.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <p className="empty">불러오는 중…</p>;

  if (!rounds) {
    const present = new Set(data.items.map((i) => i.seasonKey));
    const best = store.get(bestKey(scope));
    return (
      <GameSetup emoji="🌑" title="그림자 찾기" desc="티니핑과 똑같은 모양의 그림자를 찾아요. 그림자 5개 중 하나!">
        <SetupStep n="1" title="어떤 티니핑으로 할까요?">
          <div className="chip-scroll">
            {[['', '전체'], ...data.seasons.filter((s) => present.has(s.key)).map((s) => [s.key, s.label])].map(([k, l]) => (
              <button key={k || 'all'} type="button" className="pill" aria-pressed={scope === k} onClick={() => { setScope(k); store.set('shadow:scope', k); }}>{l}</button>
            ))}
          </div>
        </SetupStep>
        <div className="setup-start">
          <button className="btn big" type="button" onClick={start}>시작하기 ▶</button>
          <small>{best !== null ? `최고 기록 ${best}/${ROUNDS}` : `한 판에 ${ROUNDS}문제`}</small>
        </div>
      </GameSetup>
    );
  }

  return (
    <GameShell title="그림자 찾기" emoji="🌑" score={score} sound={{ on: soundOn, toggle: toggleSound }} onExit={() => setRounds(null)}>
      <div className="shadow-stage">
        <ProgressDots results={results} total={rounds.length} current={index} />
        {r && (
          <>
            <div className="shadow-target">
              <img src={asset(r.answer.image)} alt={r.answer.nameKo} draggable="false" />
            </div>
            <p className={`quiz-feedback${solved ? ' ok' : tried.length ? ' no' : ''}`} aria-live="polite">
              {solved ? `찾았다! ${josa(r.answer.nameKo, '이/가')} 맞아요 💖`
                : tried.length ? '다시 한번 찾아볼까요?' : `${josa(r.answer.nameKo, '과/와')} 똑같은 그림자는 어디 있을까요?`}
            </p>
            <div className="shadow-options">
              {r.options.map((o) => {
                const state = solved && o.id === r.answer.id ? ' correct' : tried.includes(o.id) ? ' wrong' : solved ? ' dim' : '';
                return (
                  <button key={o.id} type="button" className={`shadow-option${state}`} onClick={() => pick(o)} aria-label="그림자" disabled={solved || tried.includes(o.id)}>
                    <img src={asset(o.thumb)} alt="" draggable="false" />
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
      <ResultDialog result={result} title="모두 찾았어요!" onAgain={start} onMenu={() => setRounds(null)} menuLabel="설정 바꾸기" />
    </GameShell>
  );
}
