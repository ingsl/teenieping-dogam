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

/** 퍼즐용 정사각 그림: 연한 배경 + 캐릭터만 (동그라미 없음) */
export async function characterCanvas(item, size = 720) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, '#fff3f9');
  g.addColorStop(1, '#f1e9ff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = item.colorHex || '#ff5fa2';
  ctx.font = `${size / 10}px serif`;
  for (let i = 0; i < 14; i++) ctx.fillText(i % 2 ? '♥' : '★', ((i * 97) % 10) * size / 10, ((i * 61) % 10 + 1) * size / 10);
  ctx.globalAlpha = 1;
  if (item.image) {
    try {
      const img = new Image();
      img.src = asset(item.image);
      await img.decode();
      const s = size * 0.86;
      ctx.drawImage(img, (size - s) / 2, (size - s) / 2, s, s);
    } catch { /* 배경만 */ }
  }
  return c;
}
