import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useData, useTitle, asset } from '../lib/data.js';

// 대표 캐릭터 id 는 게임 카드 그림에만 쓴다 (없으면 아무 로열 티니핑)
const GAMES = [
  { to: '/games/quiz', emoji: '🤔', name: '누구일까?', desc: '사진·그림자·확대 사진을 보고 이름을 맞혀요', tags: ['3단계', '기수별'], art: ['heartsping'], look: 'quiz' },
  { to: '/games/shadow', emoji: '🌑', name: '그림자 찾기', desc: '티니핑과 똑같은 그림자를 5개 중에서 찾아요', tags: ['어린이 추천'], art: ['lalaping'], look: 'shadow' },
  { to: '/games/catch', emoji: '🫳', name: '티니핑을 캐치!', desc: '쏙쏙 나오는 티니핑 중 찾는 친구만 콕 잡아요', tags: ['30초', '어린이 추천'], art: ['happying', 'dadaping', 'chachaping'], look: 'catch' },
  { to: '/games/memory', emoji: '🃏', name: '메모리 게임', desc: '카드를 뒤집어 같은 티니핑 짝을 찾아요', tags: ['3×4 ~ 8×8'], art: ['gogoping', 'gogoping'], look: 'memory' },
  { to: '/games/puzzle', emoji: '🧩', name: '퍼즐', desc: '조각을 맞춰 티니핑 그림을 완성해요', tags: ['바꾸기·슬라이드'], art: ['heartsping'], look: 'puzzle' },
];

export default function Games() {
  useTitle('게임');
  const { data } = useData();
  const byId = useMemo(() => new Map((data?.items || []).map((i) => [i.id, i])), [data]);
  const fallback = data?.items.filter((i) => i.grade === '로열') || [];

  return (
    <>
      <section className="page-head">
        <h1>티니핑 게임</h1>
        <p>티니핑 친구들과 함께 놀아요!</p>
      </section>
      <div className="games-grid">
        {GAMES.map((g, gi) => {
          const art = g.art.map((id, k) => byId.get(id) || fallback[(gi + k) % Math.max(1, fallback.length)]).filter(Boolean);
          return (
            <Link key={g.to} className={`game-card look-${g.look}`} to={g.to}>
              <div className="game-art" aria-hidden="true">
                {art.map((it, k) => <img key={k} src={asset(it.thumb)} alt="" loading="lazy" />)}
              </div>
              <div className="game-body">
                <h2><span aria-hidden="true">{g.emoji}</span> {g.name}</h2>
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
