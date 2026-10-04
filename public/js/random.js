// 헤더의 "랜덤핑" 링크: 무작위 캐릭터 상세 페이지로 이동
import { url, pageUrl } from './data.js';

const link = document.getElementById('random-link');
link?.addEventListener('click', async (e) => {
  e.preventDefault();
  try {
    const ids = await fetch(url('data/ping-ids.json')).then((r) => r.json());
    location.href = pageUrl(ids[Math.floor(Math.random() * ids.length)]);
  } catch {
    location.href = url('./');
  }
});
