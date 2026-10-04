// 상세 페이지: 랜덤핑 링크 + (설정 시) 좋아요
import './random.js';
import { CONFIG } from './config.js';
import { store } from './data.js';

const btn = document.querySelector('.like-btn');
if (btn && CONFIG.counterUrl) {
  const id = btn.dataset.id;
  const countEl = btn.querySelector('.like-count');
  const liked = () => store.get('dogam:liked', []).includes(id);
  const paint = (n) => {
    btn.setAttribute('aria-pressed', String(liked()));
    if (typeof n === 'number') countEl.textContent = n.toLocaleString('ko-KR');
  };
  btn.hidden = false;
  fetch(`${CONFIG.counterUrl}/likes/${encodeURIComponent(id)}`)
    .then((r) => r.json()).then((j) => paint(j.count)).catch(() => paint());
  btn.addEventListener('click', async () => {
    if (liked()) return;
    store.set('dogam:liked', [...store.get('dogam:liked', []), id]);
    paint();
    try {
      const j = await fetch(`${CONFIG.counterUrl}/like/${encodeURIComponent(id)}`, { method: 'POST' }).then((r) => r.json());
      paint(j.count);
    } catch { /* 네트워크 실패 시 표시만 유지 */ }
  });
}
