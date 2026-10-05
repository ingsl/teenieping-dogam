import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useData, useTitle, asset } from '../lib/data.js';

// art: 카드 그림에 쓸 티니핑 id (없으면 로열 티니핑으로 대신) · look: 게임별 그림 연출
const GAMES = [
  { to: '/games/quiz', name: '누구일까?', desc: '사진을 보고 티니핑 이름을 맞혀요', tags: ['4지선다', '기수별'], art: ['twinkleping'], look: 'quiz' },
  { to: '/games/shadow', name: '숨은 티니핑 찾기', desc: '그림자나 확대된 부분을 보고 어떤 티니핑인지 찾아요', tags: ['그림자·확대', '어린이 추천'], art: ['lalaping'], look: 'shadow' },
  { to: '/games/catch', name: '티니핑을 캐치!', desc: '쏙쏙 나오는 티니핑 중 찾는 친구만 콕 잡아요', tags: ['30초', '어린이 추천'], art: ['happying'], look: 'catch' },
  { to: '/games/pang', name: '티니핑 팡팡', desc: '같은 티니핑 3개를 한 줄로 맞추면 팡!', tags: ['60초', '인기'], art: ['heartsping', 'dadaping', 'chachaping', 'lalaping', 'happying', 'gogoping'], look: 'pang' },
  { to: '/games/memory', name: '메모리 게임', desc: '카드를 뒤집어 같은 티니핑 짝을 찾아요', tags: ['3×4 ~ 8×8'], art: ['gogoping'], look: 'memory' },
  { to: '/games/puzzle', name: '퍼즐', desc: '조각을 맞춰 티니핑 그림을 완성해요', tags: ['바꾸기·슬라이드'], art: ['heartsping'], look: 'puzzle' },
];

/** 게임마다 그 게임이 떠오르는 그림 */
function GameArt({ look, art }) {
  const [a] = art;
  if (!a) return <div className="game-art" />;
  const src = asset(a.thumb);
  switch (look) {
    case 'quiz':
      return <div className="game-art"><img src={src} alt="" /><span className="art-bubble">누구?</span></div>;
    case 'shadow':
      // 그림자 + 돋보기(확대) — 두 가지 놀이 방법
      return <div className="game-art"><img className="art-shadow" src={src} alt="" /><span className="art-lens"><img src={src} alt="" /></span></div>;
    case 'catch':
      return (
        <div className="game-art art-catch">
          <span className="mini-hole"><img src={src} alt="" /><i /></span>
          <span className="mini-hole empty"><i /></span>
        </div>
      );
    case 'pang':
      return (
        <div className="game-art art-pang">
          {[0, 1, 2, 3, 1, 4, 5, 1, 2].map((k, i) => <span key={i} className={k === 1 ? 'lit' : ''}>{art[k] && <img src={asset(art[k].thumb)} alt="" />}</span>)}
        </div>
      );
    case 'memory':
      return (
        <div className="game-art art-memory">
          <span className="mini-card back" /><span className="mini-card"><img src={src} alt="" /></span><span className="mini-card"><img src={src} alt="" /></span><span className="mini-card back" />
        </div>
      );
    case 'puzzle':
      return (
        <div className="game-art">
          <div className="art-puzzle">
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className={i === 8 ? 'gap' : ''} style={{ backgroundImage: `url(${src})`, backgroundPosition: `${(i % 3) * 50}% ${Math.floor(i / 3) * 50}%` }} />
            ))}
          </div>
        </div>
      );
    default:
      return <div className="game-art"><img src={src} alt="" /></div>;
  }
}

export default function Games() {
  useTitle('게임');
  const { data } = useData();
  const byId = useMemo(() => new Map((data?.items || []).map((i) => [i.id, i])), [data]);
  const royals = data?.items.filter((i) => i.grade === '로열') || [];

  return (
    <>
      <section className="page-head">
        <h1>티니핑 게임</h1>
        <p>티니핑 친구들과 함께 놀아요!</p>
      </section>
      <div className="games-grid">
        {GAMES.map((g, gi) => {
          const art = g.art.map((id, k) => byId.get(id) || royals[(gi + k) % Math.max(1, royals.length)]).filter(Boolean);
          return (
            <Link key={g.to} className={`game-card look-${g.look}`} to={g.to}>
              <GameArt look={g.look} art={art} />
              <div className="game-body">
                <h2>{g.name}</h2>
                <p>{g.desc}</p>
                <div className="game-tags">{g.tags.map((t) => <span key={t} className="chip">{t}</span>)}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
