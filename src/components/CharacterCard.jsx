import { Crown, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { asset } from '../lib/data.js';

const GRADE_CLASS = { 로열: 'royal', 레전드: 'legend', 빌런: 'villain' };

export function GradeChip({ grade }) {
  return grade ? <span className={`chip ${GRADE_CLASS[grade] || ''}`}>{grade}</span> : null;
}

export function CharacterArt({ item, full = false }) {
  const src = full ? item.image || item.thumb : item.thumb || item.image;
  return src ? (
    <img src={asset(src)} alt={item.nameKo} loading="lazy" decoding="async" draggable="false" />
  ) : (
    <span className="placeholder" aria-hidden="true">{(item.nameKo || '?').slice(0, 1)}</span>
  );
}

/**
 * 도감 카드. 메모리 게임 앞면도 같은 모양을 쓴다(compact).
 *  - compact: 링크·영문명·칩 없이 그림 + 이름만
 */
export default function CharacterCard({ item, compact = false }) {
  const special = item.grade === '로열' || item.grade === '레전드';
  const body = (
    <>
      {!compact && special && (
        <span className={`badge ${GRADE_CLASS[item.grade]}`} title={item.grade}>
          {item.grade === '로열' ? <Crown size={16} strokeWidth={2.4} aria-hidden="true" /> : <Sparkles size={16} strokeWidth={2.4} aria-hidden="true" />}<span className="sr-only">{item.grade}</span>
        </span>
      )}
      <div className="art"><CharacterArt item={item} /></div>
      <div className="name">{item.nameKo}</div>
      {!compact && (
        <>
          <div className="en">{item.nameEn}</div>
          {item.season && <div className="chips"><span className="chip">{item.season}</span></div>}
        </>
      )}
    </>
  );
  return compact ? <div className="card compact">{body}</div> : <Link className="card" to={`/p/${item.id}`}>{body}</Link>;
}
