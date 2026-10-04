import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Heart, Tv, Users, Wand2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
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
      <Heart size={18} fill={liked ? 'currentColor' : 'none'} aria-hidden="true" /> 좋아요 {count !== null && <span>{count.toLocaleString('ko-KR')}</span>}
    </button>
  );
}

export default function Detail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, error } = useData();
  const index = data ? data.items.findIndex((i) => i.id === id) : -1;
  const it = data?.items[index];
  const prev = data && index > 0 ? data.items[index - 1] : null;
  const next = data && index >= 0 && index < data.items.length - 1 ? data.items[index + 1] : null;
  useTitle(it?.nameKo || '');

  // 키보드 ←/→ 와 손가락으로 옆으로 쓸기 → 이전/다음 티니핑
  const touch = useRef(null);
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, textarea')) return;
      if (e.key === 'ArrowLeft' && prev) navigate(`/p/${prev.id}`, { replace: true });
      if (e.key === 'ArrowRight' && next) navigate(`/p/${next.id}`, { replace: true });
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [prev, next, navigate]);
  const onTouchStart = (e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e) => {
    const t = touch.current;
    if (!t) return;
    const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      const to = dx < 0 ? next : prev;
      if (to) navigate(`/p/${to.id}`, { replace: true });
    }
  };
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/'));

  if (error) return <p className="empty">{error.message}</p>;
  if (!data) return <p className="empty">불러오는 중…</p>;
  if (!it) return <NotFound />;

  const byId = new Map(data.items.map((i) => [i.id, i]));
  const relations = (it.relations || []).filter((r) => byId.has(r.id));
  const src = it.source || {};

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <nav className="detail-nav" aria-label="티니핑 이동">
        <button type="button" className="btn ghost" onClick={goBack}><ArrowLeft size={18} aria-hidden="true" /> 도감</button>
        <div className="detail-step">
          {prev ? <Link className="icon-btn" to={`/p/${prev.id}`} replace aria-label={`이전: ${prev.nameKo}`} title={prev.nameKo}><ChevronLeft size={22} /></Link> : <span className="icon-btn disabled" aria-hidden="true"><ChevronLeft size={22} /></span>}
          <span className="detail-pos">{index + 1} / {data.items.length}</span>
          {next ? <Link className="icon-btn" to={`/p/${next.id}`} replace aria-label={`다음: ${next.nameKo}`} title={next.nameKo}><ChevronRight size={22} /></Link> : <span className="icon-btn disabled" aria-hidden="true"><ChevronRight size={22} /></span>}
        </div>
      </nav>
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
      {it.magic && <section className="section"><h2><Wand2 size={20} aria-hidden="true" /> 마법</h2><p className="pre">{it.magic}</p></section>}
      {it.episodes?.length > 0 && (
        <section className="section">
          <h2><Tv size={20} aria-hidden="true" /> 에피소드</h2>
          <ul>{it.episodes.map((e) => <li key={e.episode}>{e.label && <strong>{e.label} · </strong>}{e.episode}</li>)}</ul>
        </section>
      )}
      {relations.length > 0 && (
        <section className="section">
          <h2><Users size={20} aria-hidden="true" /> 관계</h2>
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
    </div>
  );
}
