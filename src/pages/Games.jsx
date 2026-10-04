import { Link } from 'react-router-dom';
import { useTitle } from '../lib/data.js';
import { KIDS_GAMES } from './Kids.jsx';

const GAMES = [
  { to: '/games/quiz', emoji: '❓', name: '티니핑 맞추기', desc: '사진을 보고 이름을 맞혀요.', sub: '전체·기수별 · 쉬움 / 보통(시간제한) / 어려움(그림자)' },
  { to: '/games/memory', emoji: '🃏', name: '메모리 게임', desc: '뒤집힌 카드 속 같은 티니핑 짝을 찾아요.', sub: '3×4 · 4×4 · 5×5 · 6×6 · 8×8' },
  { to: '/games/puzzle', emoji: '🧩', name: '퍼즐 게임', desc: '조각을 맞춰 티니핑 그림을 완성해요.', sub: '쉬움 3×3 · 보통 4×4 · 어려움 5×5 · 고수 6×6' },
];

export default function Games() {
  useTitle('게임');
  return (
    <>
      <section className="hero">
        <h1>티니핑 게임</h1>
        <p>하고 싶은 게임을 골라요!</p>
      </section>
      <h2 className="menu-heading">🎮 도전 게임</h2>
      <div className="game-menu">
        {GAMES.map((g) => (
          <Link key={g.to} className="game-tile" to={g.to}>
            <div className="emoji">{g.emoji}</div>
            <h2>{g.name}</h2>
            <p>{g.desc}<br />{g.sub}</p>
          </Link>
        ))}
      </div>
      <h2 className="menu-heading">🧸 유아용 놀이 <small>3~6세 · 큰 버튼 · 소리로 읽어줘요</small></h2>
      <div className="game-menu kids-menu">
        {KIDS_GAMES.map((g) => (
          <Link key={g.key} className="game-tile kids-tile-link" to={`/games/kids/${g.key}`}>
            <div className="emoji">{g.emoji}</div>
            <h2>{g.name}</h2>
            <p>{g.desc}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
