// 공용 데이터 로더 · 렌더 헬퍼 (ES module)

/** 사이트 루트 URL (이 파일은 /js/ 아래에 있으므로 한 단계 위) */
export const ROOT = new URL('../', import.meta.url);
export const url = (p) => new URL(p, ROOT).href;

let cache;
export async function loadData() {
  if (!cache) {
    cache = fetch(url('data/teeniepings.json')).then((r) => {
      if (!r.ok) throw new Error(`데이터를 불러오지 못했어요 (${r.status})`);
      return r.json();
    });
  }
  return cache;
}

export const escapeHtml = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const pageUrl = (id) => url(`p/${encodeURIComponent(id)}.html`);

const GRADE_CLASS = { 로열: 'royal', 레전드: 'legend', 빌런: 'villain' };
export const gradeChip = (g) => (g ? `<span class="chip ${GRADE_CLASS[g] || ''}">${escapeHtml(g)}</span>` : '');

/** 이미지가 있으면 <img>, 없으면 이름 첫 글자 플레이스홀더 */
export function artHtml(item, { thumb = true, cls = '' } = {}) {
  const src = thumb ? item.thumb || item.image : item.image || item.thumb;
  if (src) return `<img class="${cls}" src="${url(src)}" alt="${escapeHtml(item.nameKo)}" loading="lazy" decoding="async">`;
  return `<span class="placeholder ${cls}" aria-hidden="true">${escapeHtml((item.nameKo || '?').slice(0, 1))}</span>`;
}

/** 한글 초성 검색 지원: "ㅎㅊㅍ" → 하츄핑 */
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
export function choseong(s = '') {
  return [...s].map((ch) => {
    const code = ch.charCodeAt(0) - 0xac00;
    return code >= 0 && code < 11172 ? CHO[Math.floor(code / 588)] : ch;
  }).join('');
}
export function matches(item, q) {
  if (!q) return true;
  const query = q.trim().toLowerCase().replace(/\s+/g, '');
  const hay = [item.nameKo, item.nameEn, item.id].join(' ').toLowerCase().replace(/\s+/g, '');
  if (hay.includes(query)) return true;
  return /^[ㄱ-ㅎ]+$/.test(query) && choseong(item.nameKo).includes(query);
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** localStorage 안전 래퍼 (사생활 보호 모드 등에서 실패해도 동작) */
export const store = {
  get(key, fallback = null) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 무시 */ }
  },
};

export const formatTime = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

export function confetti(count = 80) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = document.createElement('div');
  box.className = 'confetti';
  const colors = ['#ff5fa2', '#a98bff', '#4fd1b5', '#ffc94d', '#7ec8ff'];
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i');
    p.style.left = `${Math.random() * 100}%`;
    p.style.background = colors[i % colors.length];
    p.style.animationDuration = `${1.6 + Math.random() * 1.8}s`;
    p.style.animationDelay = `${Math.random() * 0.5}s`;
    box.append(p);
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 4200);
}

/** 이미지 대신 쓸 수 있는 캐릭터 카드 그림(캔버스) — 퍼즐 등에서 사용 */
export async function characterCanvas(item, size = 600) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const color = item.colorHex || '#ffb3d1';
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, '#fff3f9');
  g.addColorStop(1, '#f1e9ff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  // 배경 장식: 하트·별
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = color;
  ctx.font = `${size / 9}px serif`;
  for (let i = 0; i < 14; i++) {
    ctx.fillText(i % 2 ? '♥' : '★', ((i * 97) % 10) * size / 10, ((i * 61) % 10 + 1) * size / 10);
  }
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(size / 2, size * 0.53, size * 0.36, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  const src = item.image || item.thumb;
  let drewImage = false;
  if (src) {
    try {
      const img = new Image();
      img.src = url(src);
      await img.decode();
      const s = size * 0.82;
      ctx.drawImage(img, (size - s) / 2, size * 0.1, s, s);
      drewImage = true;
    } catch { /* 플레이스홀더로 */ }
  }
  if (!drewImage) {
    await document.fonts?.load(`${size / 4}px Jua`).catch(() => {});
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${size / 3.2}px Jua, sans-serif`;
    ctx.fillText((item.nameKo || '?').slice(0, 1), size / 2, size * 0.5);
  }
  ctx.fillStyle = '#3b2340';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `${size / 11}px Jua, sans-serif`;
  ctx.fillText(item.nameKo || '', size / 2, size * 0.95);
  return c;
}
