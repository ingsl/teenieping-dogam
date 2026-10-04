// 누구일까? — 사진 / 그림자 / 확대 사진을 보고 티니핑 이름 맞히기
import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Moon, ZoomIn } from 'lucide-react';
import GameShell, { GameSetup, SetupStep, ProgressDots, pickArt } from '../components/GameShell.jsx';
import ResultDialog from '../components/ResultDialog.jsx';
import { useData, useTitle, asset, shuffle, store, confetti } from '../lib/data.js';
import { useFx } from '../lib/fx.jsx';
import { josa } from '../lib/korean.js';

const ROUNDS = 10;
const MODES = [
  { key: 'photo', Icon: ImageIcon, name: '사진', desc: '사진을 보고 맞혀요' },
  { key: 'shadow', Icon: Moon, name: '그림자', desc: '까만 그림자만 보고 맞혀요' },
  { key: 'zoom', Icon: ZoomIn, name: '확대', desc: '크게 확대된 부분을 보고 맞혀요' },
];
const LEVELS = [
  { key: 'easy', name: '쉬움', choices: 3, seconds: 0, desc: '보기 3개 · 시간 제한 없음' },
  { key: 'normal', name: '보통', choices: 4, seconds: 12, desc: '보기 4개 · 12초' },
  { key: 'hard', name: '어려움', choices: 4, seconds: 6, desc: '보기 4개 · 6초' },
];
const bestKey = (scope, mode, lv) => `quiz:best:${scope || 'all'}:${mode}:${lv}`;

function makeQuestions(items, scope, choices) {
  const pool = items.filter((i) => !scope || i.seasonKey === scope);
  return shuffle(pool).slice(0, ROUNDS).map((answer) => {
    // 오답은 같은 범위에서 먼저, 모자라면 전체에서
    const others = [...shuffle(pool), ...shuffle(items)].filter((i, k, a) => i.nameKo !== answer.nameKo && a.findIndex((x) => x.nameKo === i.nameKo) === k);
    // 확대 퀴즈용: 보여줄 부분(얼굴 쪽 위주)
    const zoom = { x: 30 + Math.random() * 40, y: 20 + Math.random() * 35 };
    return { answer, options: shuffle([answer, ...others.slice(0, choices - 1)]), zoom };
  });
}

export default function Quiz() {
  useTitle('누구일까?');
  const { data } = useData();
  const [fx, soundOn, toggleSound] = useFx();
  const [scope, setScope] = useState(() => store.get('quiz:scope', ''));
  const [mode, setMode] = useState(() => store.get('quiz:mode', 'photo'));
  const [level, setLevel] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null); // 고른 id, 'timeout' = 시간 초과
  const [results, setResults] = useState([]);
  const [left, setLeft] = useState(0);
  const [result, setResult] = useState(null);
  const timer = useRef();

  const q = questions[index];
  const revealed = picked !== null;
  const score = results.filter(Boolean).length;

  const start = (lv) => {
    clearTimeout(timer.current);
    setLevel(lv);
    setQuestions(makeQuestions(data.items, scope, lv.choices));
    setIndex(0); setPicked(null); setResults([]); setResult(null); setLeft(lv.seconds);
    fx.voice('start');
  };

  const answer = (id) => {
    if (revealed || !q) return;
    const ok = id === q.answer.id;
    setPicked(id);
    setResults((r) => [...r, ok]);
    fx.play(ok ? 'good' : 'bad');
    fx.voice(ok ? 'correct' : 'wrong');
    // 정답을 잠깐 보여준 뒤 자동으로 다음 문제 (화면에 버튼 줄이 새로 생기지 않게)
    timer.current = setTimeout(() => {
      setIndex((i) => i + 1);
      setPicked(null);
      setLeft(level.seconds);
    }, ok ? 1200 : 1900);
  };

  // 문제당 제한 시간
  useEffect(() => {
    if (!level?.seconds || revealed || !q) return undefined;
    if (left <= 0) { answer('timeout'); return undefined; }
    const t = setTimeout(() => { setLeft((s) => s - 1); if (left <= 4) fx.play('tick'); }, 1000);
    return () => clearTimeout(t);
  }, [left, revealed, q, level]); // eslint-disable-line react-hooks/exhaustive-deps

  // 끝
  useEffect(() => {
    if (!level || !questions.length || index < questions.length) return;
    const stars = score >= ROUNDS ? 3 : score >= 7 ? 2 : score >= 4 ? 1 : 0;
    const key = bestKey(scope, mode, level.key);
    const isBest = score > (store.get(key) ?? -1);
    if (isBest) store.set(key, score);
    if (stars >= 2) { confetti(); fx.play('win'); fx.voice('win'); }
    setResult({ stars, isBest, text: `${questions.length}문제 중 ${score}문제를 맞혔어요!` });
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimeout(timer.current), []);

  if (!data) return <p className="empty">불러오는 중…</p>;

  if (!level) {
    const present = new Set(data.items.map((i) => i.seasonKey));
    return (
      <GameSetup art={pickArt(data.items, 'heartsping')} title="누구일까?" desc={`그림을 보고 어떤 티니핑인지 맞혀요. 한 판에 ${ROUNDS}문제!`}>
        <SetupStep n="1" title="어떤 티니핑으로 할까요?">
          <div className="chip-scroll">
            {[['', '전체'], ...data.seasons.filter((s) => present.has(s.key)).map((s) => [s.key, s.label])].map(([k, l]) => (
              <button key={k || 'all'} type="button" className="pill" aria-pressed={scope === k} onClick={() => { setScope(k); store.set('quiz:scope', k); }}>{l}</button>
            ))}
          </div>
        </SetupStep>
        <SetupStep n="2" title="어떻게 보여줄까요?">
          <div className="choice-grid three">
            {MODES.map((m) => (
              <button key={m.key} type="button" className="choice" aria-pressed={mode === m.key} onClick={() => { setMode(m.key); store.set('quiz:mode', m.key); }}>
                <m.Icon className="choice-icon" size={28} aria-hidden="true" />
                <strong>{m.name}</strong>
                <small>{m.desc}</small>
              </button>
            ))}
          </div>
        </SetupStep>
        <SetupStep n="3" title="난이도를 골라 시작해요">
          <div className="choice-grid three">
            {LEVELS.map((lv) => {
              const best = store.get(bestKey(scope, mode, lv.key));
              return (
                <button key={lv.key} type="button" className="choice start" onClick={() => start(lv)}>
                  <strong>{lv.name}</strong>
                  <small>{lv.desc}</small>
                  <small className="best">{best !== null ? `최고 ${best}/${ROUNDS}` : '첫 도전!'}</small>
                </button>
              );
            })}
          </div>
        </SetupStep>
      </GameSetup>
    );
  }

  const modeInfo = MODES.find((m) => m.key === mode);
  const feedback = !q ? '' : !revealed ? '이 티니핑은 누구일까요?'
    : picked === q.answer.id ? `딩동댕! ${josa(q.answer.nameKo, '이에요/예요')}`
      : picked === 'timeout' ? `시간이 다 됐어요. 정답은 ${josa(q.answer.nameKo, '이에요/예요')}`
        : `아쉬워요! 정답은 ${josa(q.answer.nameKo, '이에요/예요')}`;

  return (
    <GameShell title="누구일까?" score={score} sound={{ on: soundOn, toggle: toggleSound }} onExit={() => { clearTimeout(timer.current); setLevel(null); }}>
      <div className="quiz-stage">
        <ProgressDots results={results} total={questions.length} current={index} />
        <div className="timebar" aria-hidden="true" style={{ visibility: level.seconds ? 'visible' : 'hidden' }}>
          <i style={{ width: `${level.seconds ? (left / level.seconds) * 100 : 100}%` }} />
        </div>
        <div className={`quiz-photo mode-${mode}${revealed ? ' revealed' : ''}`}>
          {q && (
            <img key={q.answer.id} src={asset(q.answer.image)} alt={revealed ? q.answer.nameKo : `${modeInfo.name} 문제`} draggable="false"
              style={mode === 'zoom' ? { transformOrigin: `${q.zoom.x}% ${q.zoom.y}%` } : undefined} />
          )}
        </div>
        {/* 안내 문구 자리는 높이가 고정 → 정답/오답이 바뀌어도 아래 보기들이 움직이지 않는다 */}
        <p className={`quiz-feedback${revealed ? (picked === q?.answer.id ? ' ok' : ' no') : ''}`} aria-live="polite">{feedback}</p>
        <div className={`quiz-options n${q?.options.length || level.choices}`}>
          {q?.options.map((o) => {
            const state = !revealed ? '' : o.id === q.answer.id ? ' correct' : o.id === picked ? ' wrong' : ' dim';
            return <button key={o.id} type="button" className={`quiz-option${state}`} disabled={revealed} onClick={() => answer(o.id)}>{o.nameKo}</button>;
          })}
        </div>
      </div>
      <ResultDialog result={result} title="퀴즈 끝!" onAgain={() => start(level)} onMenu={() => setLevel(null)} menuLabel="설정 바꾸기" />
    </GameShell>
  );
}
