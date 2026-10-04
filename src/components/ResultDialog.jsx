import { Star, Trophy } from 'lucide-react';
import { useEffect, useRef } from 'react';

/** 게임 결과 모달. result 가 있으면 열린다: { stars, text, isBest } */
export default function ResultDialog({ result, title, onAgain, onMenu, menuLabel }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (result && !d.open) d.showModal();
    if (!result && d.open) d.close();
  }, [result]);
  return (
    <dialog className="result" ref={ref} onClose={() => result && onMenu?.()}>
      <h2>{title}</h2>
      {result && (
        <>
          <div className="big-stars" aria-label={`별 ${result.stars}개`}>
            {[0, 1, 2].map((i) => <Star key={i} size={40} className={i < result.stars ? 'on' : 'off'} aria-hidden="true" />)}
          </div>
          <p>{result.text}</p>
          {result.isBest && <p className="best-badge"><Trophy size={16} aria-hidden="true" /> 최고 기록!</p>}
        </>
      )}
      <div className="btns">
        <button className="btn" type="button" onClick={onAgain}>한 번 더</button>
        <button className="btn ghost" type="button" onClick={onMenu}>{menuLabel}</button>
      </div>
    </dialog>
  );
}
