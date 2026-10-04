import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CharacterArt, GradeChip } from '../components/CharacterCard.jsx';
import { useData, useTitle, asset, store } from '../lib/data.js';
import { CONFIG } from '../config.js';
import NotFound from './NotFound.jsx';

const FACTS = [
  ['기수', 'season'], ['등급', 'grade'], ['성별', 'gender'], ['감정·상징', 'emotion'], ['생일', 'birthday'],
  ['모티브', 'motif'], ['심볼', 'symbol'], ['소품', 'item'], ['보석', 'jewel'], ['파트너', 'partner'],
  ['좋아하는 것', 'likes'], ['싫어하는 것', 'dislikes'], ['좋아하는 음식', 'favoriteFood'], ['성우', 'voice'],
];

function LikeButton({ id }) {
  const [count, setCount] = useState(null);
  const [liked, setLiked] = useState(() => store.get('dogam:liked', []).includes(id));
  useEffect(() => {
    fetch(`${CONFIG.counterUrl}/likes/${encodeURIComponent(id)}`).then((r) => r.json()).then((j) => setCount(j.count)).catch(() => {});
  }, [id]);
  const like = async () => {
    if (liked) return;
    store.set('dogam:liked', [...store.get('dogam:liked', []), id]);
    setLiked(true);
    try {
      const j = await fetch(`${CONFIG.counterUrl}/like/${encodeURIComponent(id)}`, { method: 'POST' }).then((r) => r.json());
      setCount(j.count);
    } catch { /* 표시만 유지 */ }
  };
  return (
    <button className="btn like-btn" type="button" aria-pressed={liked} onClick={like}>
      💗 좋아요 {count !== null && <span>{count.toLocaleString('ko-KR')}</span>}
    </button>
  );
}

export default function Detail() {
  const { id } = useParams();
  const { data, error } = useData();
  const it = data?.items.find((i) => i.id === id);
  useTitle(it?.nameKo || '');

  if (error) return <p className="empty">{error.message}</p>;
  if (!data) return <p className="empty">불러오는 중…</p>;
  if (!it) return <NotFound />;

  const byId = new Map(data.items.map((i) => [i.id, i]));
  const relations = (it.relations || []).filter((r) => byId.has(r.id));
  const src = it.source || {};

  return (
    <>
      <article className="detail">
        <div className="portrait"><CharacterArt item={it} full /></div>
        <div>
          <h1>{it.nameKo}</h1>
          <p className="sub">{it.nameEn}</p>
          <div className="chips">
            {it.season && <span className="chip">{it.season}</span>}
            <GradeChip grade={it.grade} />
          </div>
          {it.intro && <p className="intro">{it.intro}</p>}
          <dl className="facts">
            {FACTS.filter(([, k]) => it[k]).map(([label, k]) => (
              <div key={k} className="fact"><dt>{label}</dt><dd>{it[k]}</dd></div>
            ))}
          </dl>
          {CONFIG.counterUrl && <LikeButton id={it.id} />}
        </div>
      </article>
      {it.magic && <section className="section"><h2>✨ 마법</h2><p className="pre">{it.magic}</p></section>}
      {it.episodes?.length > 0 && (
        <section className="section">
          <h2>📺 에피소드</h2>
          <ul>{it.episodes.map((e) => <li key={e.episode}>{e.label && <strong>{e.label} · </strong>}{e.episode}</li>)}</ul>
        </section>
      )}
      {relations.length > 0 && (
        <section className="section">
          <h2>🤝 관계</h2>
          <div className="relations">
            {relations.map((r) => {
              const o = byId.get(r.id);
              return (
                <Link key={r.id} to={`/p/${o.id}`}>
                  {o.thumb && <img src={asset(o.thumb)} alt="" loading="lazy" />}{o.nameKo} <small>{r.label}</small>
                </Link>
              );
            })}
          </div>
        </section>
      )}
      <p className="source-note">
        출처:{' '}
        {src.namuUrl && <><a href={src.namuUrl} rel="noopener">나무위키 문서</a> (CC BY-NC-SA 2.0 KR)</>}
        {src.namuUrl && src.fandomUrl && ' · '}
        {src.fandomUrl && <><a href={src.fandomUrl} rel="noopener">Fandom 위키 문서</a> (CC BY-SA 3.0)</>}
        . 위키 내용을 자동으로 모은 것이라 틀린 부분이 있을 수 있어요.
      </p>
    </>
  );
}
