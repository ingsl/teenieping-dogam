// 숨은 티니핑 찾기 — 그림자 / 확대된 부분을 보고, 티니핑 그림 4개 중 누구인지 찾기
import { useEffect, useRef, useState } from 'react';
import { Moon, Play, ZoomIn } from 'lucide-react';
import GameShell, { GameSetup, SetupStep, ProgressDots, pickArt } from '../components/GameShell.jsx';
import ResultDialog from '../components/ResultDialog.jsx';
import { useData, useTitle, asset, shuffle, store, confetti } from '../lib/data.js';
import { useFx } from '../lib/fx.jsx';
import { josa } from '../lib/korean.js';

const ROUNDS = 10;
const CHOICES = 4;
const MODES = [
  { key: 'shadow', Icon: Moon, name: '그림자', desc: '까만 그림자를 보고 찾아요', ask: '이 그림자는 누구일까요?' },
  { key: 'zoom', Icon: ZoomIn, name: '확대', desc: '크게 확대된 부분을 보고 찾아요', ask: '확대된 이 티니핑은 누구일까요?' },
];
const bestKey = (scope, mode) => `shadow:best:${scope || 'all'}:${mode}`;

function makeRounds(items, scope) {
  const pool = items.filter((i) => !scope || i.seasonKey === scope);
  return shuffle(pool).slice(0, ROUNDS).map((answer) => {
    const others = [...shuffle(pool), ...shuffle(items)].filter((i, k, a) => i.id !== answer.id && a.findIndex((x) => x.id === i.id) === k);
    // 확대용: 보여줄 부분(얼굴 쪽 위주)
    const zoom = { x: 30 + Math.random() * 40, y: 20 + Math.random() * 35 };
    return { answer, options: shuffle([answer, ...others.slice(0, CHOICES - 1)]), zoom };
  });
}

export default function Shadow() {
  useTitle('숨은 티니핑 찾기');
  const { data } = useData();
  const [fx, soundOn, toggleSound] = useFx();
  const [scope, setScope] = useState(() => store.get('shadow:scope', ''));
  const [mode, setMode] = useState(() => store.get('shadow:mode', 'shadow'));
  const [rounds, setRounds] = useState(null);
  const [index, setIndex] = useState(0);
  const [tried, setTried] = useState([]); // 이번 문제에서 틀린 보기 id
  const [solved, setSolved] = useState(false);
  const [results, setResults] = useState([]); // 한 번에 맞혔는지
  const [result, setResult] = useState(null);
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);

  const r = rounds?.[index];
  const score = results.filter(Boolean).length;
  const modeInfo = MODES.find((m) => m.key === mode) || MODES[0];

  const start = () => {
    clearTimeout(timer.current);
    setRounds(makeRounds(data.items, scope));
    setIndex(0); setTried([]); setSolved(false); setResults([]); setResult(null);
    fx.voice('start');
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
    }, 1500);
  };

  useEffect(() => {
    if (!rounds || results.length < rounds.length) return undefined;
    const t = setTimeout(() => {
      const stars = score >= 9 ? 3 : score >= 6 ? 2 : 1;
      const key = bestKey(scope, mode);
      const isBest = score > (store.get(key) ?? -1);
      if (isBest) store.set(key, score);
      confetti(); fx.play('win'); fx.voice('win');
      setResult({ stars, isBest, text: `${rounds.length}문제 중 ${score}문제를 한 번에 찾았어요!` });
    }, 900);
    return () => clearTimeout(t);
  }, [results.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <p className="empty">불러오는 중…</p>;

  if (!rounds) {
    const present = new Set(data.items.map((i) => i.seasonKey));
    const best = store.get(bestKey(scope, mode));
    return (
      <GameSetup art={pickArt(data.items, 'lalaping')} artStyle="shadow" title="숨은 티니핑 찾기" desc={`그림자나 확대된 부분을 보고, 티니핑 ${CHOICES}명 중 누구인지 찾아요.`}>
        <SetupStep n="1" title="어떤 티니핑으로 할까요?">
          <div className="chip-scroll">
            {[['', '전체'], ...data.seasons.filter((s) => present.has(s.key)).map((s) => [s.key, s.label])].map(([k, l]) => (
              <button key={k || 'all'} type="button" className="pill" aria-pressed={scope === k} onClick={() => { setScope(k); store.set('shadow:scope', k); }}>{l}</button>
            ))}
          </div>
        </SetupStep>
        <SetupStep n="2" title="무엇을 보고 찾을까요?">
          <div className="choice-grid two">
            {MODES.map((m) => (
              <button key={m.key} type="button" className="choice" aria-pressed={mode === m.key} onClick={() => { setMode(m.key); store.set('shadow:mode', m.key); }}>
                <m.Icon className="choice-icon" size={28} aria-hidden="true" />
                <strong>{m.name}</strong>
                <small>{m.desc}</small>
              </button>
            ))}
          </div>
        </SetupStep>
        <div className="setup-start">
          <button className="btn big" type="button" onClick={start}><Play size={20} fill="currentColor" aria-hidden="true" /> 시작하기</button>
          <small>{best !== null ? `최고 기록 ${best}/${ROUNDS}` : `한 판에 ${ROUNDS}문제`}</small>
        </div>
      </GameSetup>
    );
  }

  return (
    <GameShell title="숨은 티니핑 찾기" score={score} sound={{ on: soundOn, toggle: toggleSound }} onExit={() => { clearTimeout(timer.current); setRounds(null); }}>
      <div className="shadow-stage">
        <ProgressDots results={results} total={rounds.length} current={index} />
        {r && (
          <>
            <div className={`quiz-photo mode-${mode}${solved ? ' revealed' : ''}`}>
              <img key={r.answer.id} src={asset(r.answer.image)} alt={solved ? r.answer.nameKo : `${modeInfo.name} 문제`} draggable="false"
                style={mode === 'zoom' ? { transformOrigin: `${r.zoom.x}% ${r.zoom.y}%` } : undefined} />
            </div>
            <p className={`quiz-feedback${solved ? ' ok' : tried.length ? ' no' : ''}`} aria-live="polite">
              {solved ? `찾았다! ${josa(r.answer.nameKo, '이에요/예요')}`
                : tried.length ? '다시 한번 찾아볼까요?' : modeInfo.ask}
            </p>
            <div className="shadow-options">
              {r.options.map((o) => {
                const state = solved && o.id === r.answer.id ? ' correct' : tried.includes(o.id) ? ' wrong' : solved ? ' dim' : '';
                return (
                  <button key={o.id} type="button" className={`shadow-option${state}`} onClick={() => pick(o)} disabled={solved || tried.includes(o.id)}>
                    <img src={asset(o.thumb)} alt="" draggable="false" />
                    <span className="name">{o.nameKo}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
      <ResultDialog result={result} title="모두 찾았어요!" onAgain={start} />
    </GameShell>
  );
}
