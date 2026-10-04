// 티니핑 맞추기 퀴즈: 사진(또는 그림자)을 보고 이름 고르기
import { useEffect, useRef, useState } from 'react';
import ResultDialog from '../components/ResultDialog.jsx';
import { useData, useTitle, asset, shuffle, store, confetti } from '../lib/data.js';
import { useFx, SoundToggle } from '../lib/fx.jsx';

const ROUNDS = 10;
const LEVELS = [
  { key: 'easy', name: '쉬움', choices: 3, seconds: 0, silhouette: false, desc: '3개 중 고르기 · 시간 제한 없음' },
  { key: 'normal', name: '보통', choices: 3, seconds: 10, silhouette: false, desc: '3개 중 고르기 · 문제당 10초' },
  { key: 'hard', name: '어려움', choices: 4, seconds: 7, silhouette: true, desc: '그림자만 보고 4개 중 · 7초' },
];
const bestKey = (scope, lv) => `quiz:best:${scope || 'all'}:${lv}`;

function makeQuestions(items, scope, choices) {
  const pool = items.filter((i) => !scope || i.seasonKey === scope);
  return shuffle(pool).slice(0, ROUNDS).map((answer) => {
    // 오답은 같은 범위에서, 모자라면 전체에서 (이름이 겹치지 않게)
    const others = shuffle(pool.filter((i) => i.id !== answer.id));
    const extra = shuffle(items.filter((i) => i.id !== answer.id && !others.includes(i)));
    const wrong = [...others, ...extra].filter((i, k, a) => a.findIndex((x) => x.nameKo === i.nameKo) === k && i.nameKo !== answer.nameKo).slice(0, choices - 1);
    return { answer, options: shuffle([answer, ...wrong]) };
  });
}

export default function Quiz() {
  useTitle('티니핑 맞추기');
  const { data } = useData();
  const [fx, soundOn, toggleSound] = useFx();
  const [scope, setScope] = useState(() => store.get('quiz:scope', ''));
  const [level, setLevel] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null); // 고른 id ('timeout' = 시간 초과)
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(0);
  const [result, setResult] = useState(null);
  const nextTimer = useRef();

  const q = questions[index];
  const revealed = picked !== null;

  const start = (lv) => {
    setLevel(lv);
    setQuestions(makeQuestions(data.items, scope, lv.choices));
    setIndex(0); setPicked(null); setScore(0); setResult(null); setLeft(lv.seconds);
  };

  const answer = (id) => {
    if (revealed) return;
    const ok = id === q.answer.id;
    setPicked(id);
    if (ok) { setScore((s) => s + 1); fx.play('good'); } else fx.play('bad');
    fx.say(q.answer.nameKo);
    nextTimer.current = setTimeout(next, ok ? 1100 : 1700);
  };

  const next = () => {
    clearTimeout(nextTimer.current);
    setIndex((i) => i + 1);
    setPicked(null);
    setLeft(level.seconds);
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
    if (!level || index < questions.length || !questions.length) return;
    const stars = score >= ROUNDS ? 3 : score >= 7 ? 2 : score >= 4 ? 1 : 0;
    const key = bestKey(scope, level.key);
    const isBest = score > (store.get(key) ?? -1);
    if (isBest) store.set(key, score);
    if (stars >= 2) { confetti(); fx.play('win'); }
    setResult({ stars, isBest, text: `${questions.length}문제 중 ${score}개 맞혔어요! (${level.name})` });
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimeout(nextTimer.current), []);

  if (!data) return <p className="empty">불러오는 중…</p>;

  if (!level) {
    const present = new Set(data.items.map((i) => i.seasonKey));
    return (
      <section>
        <div className="hero">
          <h1>❓ 티니핑 맞추기</h1>
          <p>사진을 보고 어떤 티니핑인지 맞혀요! 한 판에 {ROUNDS}문제.</p>
        </div>
        <div className="section">
          <h2>1. 어떤 티니핑으로?</h2>
          <div className="filter-row">
            {[['', '전체'], ...data.seasons.filter((s) => present.has(s.key)).map((s) => [s.key, s.label])].map(([k, l]) => (
              <button key={k || 'all'} type="button" className="pill" aria-pressed={scope === k} onClick={() => { setScope(k); store.set('quiz:scope', k); }}>{l}</button>
            ))}
          </div>
        </div>
        <div className="section">
          <h2>2. 난이도</h2>
          <div className="level-grid">
            {LEVELS.map((lv) => {
              const best = store.get(bestKey(scope, lv.key));
              return (
                <button key={lv.key} className="level" type="button" onClick={() => start(lv)}>
                  <div className="size">{lv.name}</div>
                  <div className="desc">{lv.desc}</div>
                  <div className="best">{best !== null ? `최고 ${best} / ${ROUNDS}` : '아직 기록 없음'}</div>
                </button>
              );
            })}
          </div>
          <div className="option-row"><SoundToggle on={soundOn} toggle={toggleSound} /></div>
        </div>
      </section>
    );
  }

  return (
    <section className="quiz">
      <div className="hud">
        <div className="stats">
          <span>📝 {Math.min(index + 1, questions.length)} / {questions.length}</span>
          <span>⭐ {score}점</span>
          {level.seconds > 0 && q && <span className={left <= 3 && !revealed ? 'danger' : ''}>⏱ {left}초</span>}
        </div>
        <div className="actions">
          <SoundToggle on={soundOn} toggle={toggleSound} />
          <button className="btn ghost" type="button" onClick={() => { clearTimeout(nextTimer.current); setLevel(null); }}>그만하기</button>
        </div>
      </div>
      {level.seconds > 0 && q && (
        <div className="timebar" aria-hidden="true"><i style={{ width: `${(left / level.seconds) * 100}%` }} /></div>
      )}
      {q && (
        <>
          <div className={`quiz-photo${level.silhouette && !revealed ? ' silhouette' : ''}`}>
            <img key={q.answer.id} src={asset(q.answer.image)} alt={revealed ? q.answer.nameKo : '누구일까요?'} draggable="false" />
          </div>
          <p className="quiz-ask" aria-live="polite">
            {!revealed ? '이 티니핑은 누구일까요?'
              : picked === q.answer.id ? `딩동댕! ${q.answer.nameKo} 💖`
                : picked === 'timeout' ? `시간 끝! 정답은 ${q.answer.nameKo}` : `아쉬워요! 정답은 ${q.answer.nameKo}`}
          </p>
          <div className={`quiz-options n${q.options.length}`}>
            {q.options.map((o) => {
              const state = !revealed ? '' : o.id === q.answer.id ? ' correct' : o.id === picked ? ' wrong' : ' dim';
              return <button key={o.id} type="button" className={`quiz-option${state}`} onClick={() => answer(o.id)}>{o.nameKo}</button>;
            })}
          </div>
          {revealed && <div className="option-row center"><button className="btn" type="button" onClick={next}>다음 ▶</button></div>}
        </>
      )}
      <ResultDialog result={result} title="퀴즈 끝!" onAgain={() => start(level)} onMenu={() => setLevel(null)} menuLabel="다른 난이도" />
    </section>
  );
}
