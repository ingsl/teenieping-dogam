import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { ArrowRight, ArrowUp, Search, Sparkles, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import CharacterCard, { CharacterArt, GradeChip } from '../components/CharacterCard.jsx';
import { useData, useTitle, matches } from '../lib/data.js';

/** 오늘 날짜로 정해지는 "오늘의 티니핑" (하루 동안 같음) */
function todaysPick(items) {
  const d = new Date();
  const seed = d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate();
  return items[seed % items.length];
}

function Spotlight({ item }) {
  return (
    <Link className="spotlight" to={`/p/${item.id}`}>
      <div className="spotlight-art"><CharacterArt item={item} full /></div>
      <div className="spotlight-body">
        <span className="spotlight-label"><Sparkles size={15} aria-hidden="true" /> 오늘의 티니핑</span>
        <strong className="spotlight-name">{item.nameKo}</strong>
        <div className="chips">
          {item.season && <span className="chip">{item.season}</span>}
          <GradeChip grade={item.grade} />
        </div>
        {item.intro && <p className="spotlight-intro">{item.intro}</p>}
        <span className="spotlight-more">자세히 보기 <ArrowRight size={16} aria-hidden="true" /></span>
      </div>
    </Link>
  );
}

function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > 900);
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <button type="button" className={`to-top${show ? ' show' : ''}`} aria-label="맨 위로" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><ArrowUp size={22} /></button>
  );
}

export default function Dogam() {
  useTitle('');
  const { data, error } = useData();
  // 검색어·필터는 주소(?q=&season=&grade=)에 남겨서 공유·뒤로가기가 된다
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const season = params.get('season') || '';
  const grade = params.get('grade') || '';
  const deferredQ = useDeferredValue(q);
  const set = (key, value) => {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    setParams(next, { replace: true });
  };

  const list = useMemo(() => (data?.items || []).filter((it) =>
    (!season || it.seasonKey === season) && (!grade || it.grade === grade) && matches(it, deferredQ),
  ), [data, season, grade, deferredQ]);
  const pick = useMemo(() => data && todaysPick(data.items.filter((i) => i.intro)), [data]);

  if (error) return <p className="empty">{error.message}</p>;
  const present = new Set(data?.items.map((i) => i.seasonKey));
  const filtering = q || season || grade;

  return (
    <>
      <section className="page-head">
        <h1>티니핑 도감</h1>
        <p>{data ? `티니핑 ${data.items.length}마리를 만나 보세요!` : '티니핑 친구들을 불러오는 중…'}</p>
      </section>

      {pick && !filtering && <Spotlight item={pick} />}

      <section className="toolbar" aria-label="검색과 필터">
        <div className="search-wrap">
          <label className="sr-only" htmlFor="q">이름 검색</label>
          <Search className="search-icon" size={20} aria-hidden="true" />
          <input id="q" className="search" type="search" placeholder="이름으로 찾기 (하츄핑, Heartsping, ㅎㅊㅍ)" autoComplete="off"
            value={q} onChange={(e) => set('q', e.target.value)} enterKeyHint="search" />
          {q && <button type="button" className="search-clear" aria-label="검색어 지우기" onClick={() => set('q', '')}><X size={16} /></button>}
        </div>
        {data && (
          <>
            <div className="chip-scroll" role="group" aria-label="기수">
              {[['', '전체 기수'], ...data.seasons.filter((s) => present.has(s.key)).map((s) => [s.key, s.label])].map(([v, l]) => (
                <button key={v || 'all'} type="button" className="pill" aria-pressed={season === v} onClick={() => set('season', v)}>{l}</button>
              ))}
            </div>
            <div className="chip-scroll" role="group" aria-label="등급">
              {[['', '모든 등급'], ...data.grades.map((g) => [g, g])].map(([v, l]) => (
                <button key={v || 'all'} type="button" className="pill small" aria-pressed={grade === v} onClick={() => set('grade', v)}>{l}</button>
              ))}
            </div>
          </>
        )}
      </section>

      <div className="result-meta" aria-live="polite">
        {data && <span>{filtering ? `${list.length}마리 찾았어요` : `전체 ${list.length}마리`}</span>}
        {filtering && <button type="button" className="link-btn" onClick={() => setParams({}, { replace: true })}>필터 초기화</button>}
      </div>

      <div className="grid">
        {data
          ? list.map((it) => <CharacterCard key={it.id} item={it} />)
          : Array.from({ length: 12 }, (_, i) => <div key={i} className="card skeleton" aria-hidden="true"><div className="art" /><div className="name" /></div>)}
      </div>
      {data && !list.length && (
        <div className="empty">
          <p>찾는 티니핑이 없어요</p>
          <button type="button" className="btn ghost" onClick={() => setParams({}, { replace: true })}>전체 보기</button>
        </div>
      )}
      <BackToTop />
    </>
  );
}
