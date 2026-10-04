import { Link } from 'react-router-dom';
import { ArrowLeft, Star, X } from 'lucide-react';
import { SoundToggle } from '../lib/fx.jsx';
import { asset } from '../lib/data.js';

/** 게임 화면 공통 틀: 상단 바(뒤로·제목·점수·소리) — 높이가 고정이라 진행 중 화면이 흔들리지 않는다 */
export default function GameShell({ title, score, onExit, sound, children, wide = false }) {
  return (
    <section className={`game-shell${wide ? ' wide' : ''}`}>
      <div className="game-bar">
        {onExit
          ? <button className="icon-btn" type="button" onClick={onExit} aria-label="그만하기"><X size={20} /></button>
          : <Link className="icon-btn" to="/games" aria-label="게임 목록으로"><ArrowLeft size={20} /></Link>}
        <h1 className="game-title">{title}</h1>
        <div className="game-bar-right">
          {score !== undefined && (
            <span className="score-pill" aria-label={`점수 ${score}`}><Star size={16} className="star-icon" aria-hidden="true" />{score}</span>
          )}
          {sound && <SoundToggle on={sound.on} toggle={sound.toggle} />}
        </div>
      </div>
      {children}
    </section>
  );
}

/** 문제 진행 표시: 맞음(초록) · 틀림(분홍) · 지금 문제(크게) · 남은 문제(회색) */
export function ProgressDots({ results, total, current }) {
  return (
    <ol className="progress-dots" aria-label={`${Math.min(current + 1, total)} / ${total} 문제`}>
      {Array.from({ length: total }, (_, i) => (
        <li key={i} className={results[i] === true ? 'ok' : results[i] === false ? 'no' : i === current ? 'now' : ''} />
      ))}
    </ol>
  );
}

/**
 * 게임 시작 전 설정 화면 공통 틀
 *  art: 대표 캐릭터 (이모지 대신 티니핑 그림) · artStyle: 'shadow' 면 그림자로
 */
export function GameSetup({ art, artStyle, title, desc, children }) {
  return (
    <section className="game-setup">
      <Link className="back-link" to="/games"><ArrowLeft size={18} aria-hidden="true" /> 게임 목록</Link>
      <div className="setup-head">
        {art?.thumb && <img className={`setup-art${artStyle ? ` ${artStyle}` : ''}`} src={asset(art.thumb)} alt="" aria-hidden="true" />}
        <h1>{title}</h1>
        <p>{desc}</p>
      </div>
      {children}
    </section>
  );
}

/** 설정 화면의 한 단계 (번호 + 제목 + 선택지) */
export function SetupStep({ n, title, children }) {
  return (
    <div className="setup-step">
      <h2><span className="step-n">{n}</span>{title}</h2>
      {children}
    </div>
  );
}

/** 게임 대표 캐릭터: 지정한 id 가 없으면 아무 로열 티니핑 */
export function pickArt(items, id) {
  return items.find((i) => i.id === id) || items.find((i) => i.grade === '로열') || items[0];
}
