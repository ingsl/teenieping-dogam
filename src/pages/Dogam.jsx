import { useDeferredValue, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import CharacterCard from '../components/CharacterCard.jsx';
import { useData, useTitle, matches } from '../lib/data.js';

function Pills({ label, options, value, onChange }) {
  return (
    <div className="filter-row" role="group" aria-label={`${label} 필터`}>
      <span className="label">{label}</span>
      {[['', '전체'], ...options].map(([v, l]) => (
        <button key={v || 'all'} type="button" className="pill" aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
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

  if (error) return <p className="empty">{error.message}</p>;
  const present = new Set(data?.items.map((i) => i.seasonKey));

  return (
    <>
      <section className="hero">
        <h1>티니핑 도감</h1>
        <p>모든 티니핑을 한눈에! 이름(한글·영문·초성)으로 찾아보세요.</p>
      </section>
      <section className="toolbar" aria-label="검색과 필터">
        <label className="sr-only" htmlFor="q">이름 검색</label>
        <input id="q" className="search" type="search" placeholder="🔍 하츄핑, Heartsping, ㅎㅊㅍ …" autoComplete="off"
          value={q} onChange={(e) => set('q', e.target.value)} />
        {data && (
          <>
            <Pills label="기수" value={season} onChange={(v) => set('season', v)}
              options={data.seasons.filter((s) => present.has(s.key)).map((s) => [s.key, s.label])} />
            <Pills label="등급" value={grade} onChange={(v) => set('grade', v)} options={data.grades.map((g) => [g, g])} />
          </>
        )}
        <div className="result-meta"><span aria-live="polite">{data ? `${list.length} / ${data.items.length}마리` : '불러오는 중…'}</span></div>
      </section>
      <div className="grid">
        {list.map((it) => <CharacterCard key={it.id} item={it} />)}
      </div>
      {data && !list.length && <p className="empty">찾는 티니핑이 없어요 🥲</p>}
    </>
  );
}
