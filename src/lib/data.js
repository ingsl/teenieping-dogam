// 공용 데이터 로더 · 유틸
import { useEffect, useState } from 'react';

/** public/ 아래 정적 파일 주소 (GitHub Pages 하위 경로 포함) */
export const asset = (p) => `${import.meta.env.BASE_URL}${p}`;

let cache;
export function loadData() {
  cache ||= fetch(asset('data/teeniepings.json')).then((r) => {
    if (!r.ok) throw new Error(`데이터를 불러오지 못했어요 (${r.status})`);
    return r.json();
  });
  return cache;
}

/** 도감 데이터 훅: { data, error } — data 가 오기 전엔 null */
export function useData() {
  const [state, setState] = useState({ data: null, error: null });
  useEffect(() => {
    let alive = true;
    loadData().then(
      (data) => alive && setState({ data, error: null }),
      (error) => alive && setState({ data: null, error }),
    );
    return () => { alive = false; };
  }, []);
  return state;
}

export function useTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} — 티니핑 도감` : '티니핑 도감';
  }, [title]);
}

/** 한글 초성 검색: "ㅎㅊㅍ" → 하츄핑 */
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

/** 1초마다 올라가는 타이머. running 이 false 면 멈춤 */
export function useTimer(running, resetKey) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => { setSeconds(0); }, [resetKey]);
  useEffect(() => {
    if (!running) return undefined;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  return seconds;
}

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

// ── 퍼즐 배경: 조각마다 생김새가 달라 위치를 알아볼 수 있는 파스텔 동화 풍경 ──
const SCENE_COLORS = ['#ff8fc4', '#ffb86b', '#ffe066', '#7ed9a6', '#7cc8ff', '#b79cff', '#ff9e9e', '#6fe0d6'];

/** id 로 정해지는 난수 (같은 티니핑은 항상 같은 배경) */
function seeded(text) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function pathHeart(ctx, x, y, r) {
  ctx.moveTo(x, y + r * 0.9);
  ctx.bezierCurveTo(x - r * 1.5, y - r * 0.1, x - r * 0.7, y - r * 1.25, x, y - r * 0.45);
  ctx.bezierCurveTo(x + r * 0.7, y - r * 1.25, x + r * 1.5, y - r * 0.1, x, y + r * 0.9);
}
function pathStar(ctx, x, y, r, points = 5, inner = 0.48) {
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points, rr = i % 2 ? r * inner : r;
    ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}
function drawFlower(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#fff6b8';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.32, 0, Math.PI * 2);
  ctx.fill();
}
function drawCloud(ctx, x, y, r) {
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.arc(x - r * 0.7, y + r * 0.15, r * 0.5, 0, Math.PI * 2);
  ctx.arc(x, y - r * 0.15, r * 0.7, 0, Math.PI * 2);
  ctx.arc(x + r * 0.75, y + r * 0.1, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
}
function drawJewel(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.8, y - r * 0.3); ctx.lineTo(x - r * 0.4, y - r * 0.8); ctx.lineTo(x + r * 0.4, y - r * 0.8);
  ctx.lineTo(x + r * 0.8, y - r * 0.3); ctx.lineTo(x, y + r * 0.9); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.moveTo(x - r * 0.4, y - r * 0.8); ctx.lineTo(x, y - r * 0.3); ctx.lineTo(x - r * 0.8, y - r * 0.3); ctx.closePath();
  ctx.fill();
}

/** 하늘(가로·세로로 색이 바뀌는 그라데이션) + 무지개 + 언덕 + 칸마다 다른 장식 */
function drawScene(ctx, size, item) {
  const rnd = seeded(item.id || 'teenieping');
  // 1) 하늘: 왼쪽 위 분홍 → 오른쪽 위 보라, 아래로 갈수록 복숭아·민트 (어느 칸이든 바탕색이 다르다)
  const top = ctx.createLinearGradient(0, 0, size, 0);
  top.addColorStop(0, '#ffd6ec'); top.addColorStop(0.5, '#ffe9f4'); top.addColorStop(1, '#ddd2ff');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, size, size);
  const down = ctx.createLinearGradient(0, 0, 0, size);
  down.addColorStop(0, 'rgba(255,255,255,0)'); down.addColorStop(1, 'rgba(255,230,190,0.85)');
  ctx.fillStyle = down;
  ctx.fillRect(0, 0, size, size);
  const side = ctx.createLinearGradient(size, 0, 0, size);
  side.addColorStop(0, 'rgba(190,240,255,0)'); side.addColorStop(1, 'rgba(190,240,225,0.6)');
  ctx.fillStyle = side;
  ctx.fillRect(0, 0, size, size);

  // 2) 무지개 (왼쪽 위 → 오른쪽으로 걸친 큰 띠)
  const rcx = size * (0.2 + rnd() * 0.6), rcy = size * 0.78, band = size * 0.035;
  ['#ffadc9', '#ffcf9e', '#fff1a1', '#bff0c2', '#b5ddff', '#d3c2ff'].forEach((col, i) => {
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = band;
    ctx.beginPath();
    ctx.arc(rcx, rcy, size * 0.62 - i * band, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;

  // 3) 구름 몇 개
  for (let i = 0; i < 4; i++) drawCloud(ctx, size * (0.1 + 0.27 * i + rnd() * 0.08), size * (0.08 + rnd() * 0.3), size * (0.05 + rnd() * 0.03));

  // 4) 언덕 두 겹 (아래쪽 칸들은 땅 모양으로 구분)
  [['#c8f0d0', 0.8, 0.07], ['#a8e6bd', 0.88, 0.05]].forEach(([col, base, amp], k) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, size);
    const ph = rnd() * Math.PI * 2;
    for (let x = 0; x <= size; x += size / 40) ctx.lineTo(x, size * (base + amp * Math.sin(ph + (x / size) * Math.PI * (2 + k))));
    ctx.lineTo(size, size);
    ctx.fill();
  });

  // 5) 6×6 칸마다 장식 하나씩 (모양 × 색 조합이 겹치지 않게 돌려가며)
  const N = 6, cell = size / N;
  const shapes = ['heart', 'star', 'flower', 'sparkle', 'jewel', 'dot'];
  const offset = Math.floor(rnd() * shapes.length);
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const k = r * N + c;
      const shape = shapes[(c + r * 2 + offset) % shapes.length];
      const color = SCENE_COLORS[(c * 3 + r * 5 + offset) % SCENE_COLORS.length];
      const x = (c + 0.2 + rnd() * 0.6) * cell, y = (r + 0.2 + rnd() * 0.6) * cell;
      const rad = cell * (0.16 + rnd() * 0.1);
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = color;
      ctx.beginPath();
      if (shape === 'heart') { pathHeart(ctx, x, y, rad); ctx.fill(); }
      else if (shape === 'star') { pathStar(ctx, x, y, rad * 1.1); ctx.fill(); }
      else if (shape === 'sparkle') { pathStar(ctx, x, y, rad * 1.2, 4, 0.28); ctx.fill(); }
      else if (shape === 'flower') drawFlower(ctx, x, y, rad, color);
      else if (shape === 'jewel') drawJewel(ctx, x, y, rad, color);
      else {
        ctx.arc(x, y, rad * 0.7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath(); ctx.arc(x - rad * 0.25, y - rad * 0.25, rad * 0.22, 0, Math.PI * 2); ctx.fill();
      }
      // 작은 반짝이 하나 더 (칸 안 다른 자리)
      if (k % 2 === 0) {
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        pathStar(ctx, (c + rnd()) * cell, (r + rnd()) * cell, cell * 0.06, 4, 0.3);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}

/** 퍼즐용 정사각 그림: 동화 풍경 배경(조각마다 달라 맞추기 쉬움) + 캐릭터 */
export async function characterCanvas(item, size = 720) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  drawScene(ctx, size, item);
  // 캐릭터 뒤 은은한 후광 (캐릭터 대표색)
  const halo = ctx.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size * 0.36);
  halo.addColorStop(0, 'rgba(255,255,255,0.6)');
  halo.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, size, size);
  if (item.image) {
    try {
      // decode() 는 백그라운드 탭에서 멈출 수 있어 load 이벤트 + 시간 제한으로 기다린다
      const img = await new Promise((resolve, reject) => {
        const im = new Image();
        const t = setTimeout(() => reject(new Error('timeout')), 5000);
        im.onload = () => { clearTimeout(t); resolve(im); };
        im.onerror = () => { clearTimeout(t); reject(new Error('load error')); };
        im.src = asset(item.image);
      });
      const s = size * 0.8;
      ctx.drawImage(img, (size - s) / 2, (size - s) / 2, s, s);
    } catch { /* 배경만 */ }
  }
  return c;
}
