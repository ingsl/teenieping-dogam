import { Link } from 'react-router-dom';
import { useTitle } from '../lib/data.js';

export default function Games() {
  useTitle('게임');
  return (
    <>
      <section className="hero">
        <h1>티니핑 게임</h1>
        <p>하고 싶은 게임을 골라요!</p>
      </section>
      <div className="game-menu">
        <Link className="game-tile" to="/games/memory">
          <div className="emoji">🃏</div>
          <h2>메모리 게임</h2>
          <p>뒤집힌 카드 속 같은 티니핑 짝을 찾아요.<br />3×4 · 4×4 · 5×5 · 6×6 · 8×8</p>
        </Link>
        <Link className="game-tile" to="/games/puzzle">
          <div className="emoji">🧩</div>
          <h2>퍼즐 게임</h2>
          <p>조각을 맞춰 티니핑 그림을 완성해요.<br />쉬움 3×3 · 보통 4×4 · 어려움 5×5 · 고수 6×6</p>
        </Link>
      </div>
    </>
  );
}
