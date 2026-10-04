// 게임 소리: 부드러운 실로폰·종소리 느낌의 효과음(Web Audio, 파일 없음)
// 목소리: 브라우저 기계음(TTS)은 쓰지 않는다. public/voice/<이름>.mp3 녹음 파일이 있을 때만 재생.
//   예) public/voice/correct.mp3 ("우와~ 정답이에요!"), wrong.mp3, start.mp3, win.mp3
import { useCallback, useMemo, useState } from 'react';
import { asset, store } from './data.js';

let ctx;
function audio() {
  ctx ||= new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** 실로폰 같은 맑은 음: 사인파 + 배음, 빠른 감쇠 */
function bell(freq, start = 0, dur = 0.5, gain = 0.09) {
  try {
    const a = audio();
    const t = a.currentTime + start;
    for (const [mult, g] of [[1, 1], [2, 0.25], [3, 0.08]]) {
      const o = a.createOscillator();
      const v = a.createGain();
      o.type = 'sine';
      o.frequency.value = freq * mult;
      v.gain.setValueAtTime(0.0001, t);
      v.gain.exponentialRampToValueAtTime(gain * g, t + 0.01);
      v.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(v).connect(a.destination);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  } catch { /* 소리 없이 진행 */ }
}

/** "스윽~" — 걸러낸 잡음이 위로 쓸려 올라가는 소리 (퍼즐 조각 이동) */
function swoosh(dur = 0.22, gain = 0.18) {
  try {
    const a = audio();
    const t = a.currentTime;
    const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = a.createBufferSource();
    src.buffer = buf;
    const bp = a.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(500, t);
    bp.frequency.exponentialRampToValueAtTime(2400, t + dur);
    const v = a.createGain();
    v.gain.setValueAtTime(0.0001, t);
    v.gain.exponentialRampToValueAtTime(gain, t + dur * 0.3);
    v.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(v).connect(a.destination);
    src.start(t);
  } catch { /* 무시 */ }
}

// 도레미… (C5 기준)
const N = { C5: 523, D5: 587, E5: 659, G5: 784, A5: 880, C6: 1047, E6: 1319, G4: 392, E4: 330 };
const SOUNDS = {
  good: () => { bell(N.E5, 0, 0.35); bell(N.G5, 0.09, 0.35); bell(N.C6, 0.18, 0.6); },
  bad: () => { bell(N.E4, 0, 0.35, 0.06); bell(N.G4 * 0.9, 0.12, 0.45, 0.05); },
  pop: () => bell(N.A5 + Math.random() * 200, 0, 0.18, 0.07),
  win: () => [N.C5, N.E5, N.G5, N.C6, N.E6].forEach((f, i) => bell(f, i * 0.11, 0.7, 0.08)),
  tick: () => bell(N.C6, 0, 0.08, 0.03),
  flip: () => swoosh(0.12, 0.08),          // 카드 뒤집기 "착"
  slide: () => swoosh(0.22, 0.18),         // 퍼즐 조각 "스윽~"
  select: () => bell(N.G5, 0, 0.15, 0.05), // 조각 고르기 "똑"
};

const voiceCache = {};
function playVoice(name) {
  try {
    voiceCache[name] ||= new Audio(asset(`voice/${name}.mp3`));
    const a = voiceCache[name];
    a.currentTime = 0;
    a.play().catch(() => {}); // 파일이 없으면 조용히 무시
  } catch { /* 무시 */ }
}

/** [fx, soundOn, toggle] — fx.play('good'), fx.voice('correct') */
export function useFx() {
  const [on, setOn] = useState(() => store.get('games:sound', true));
  const toggle = useCallback(() => setOn((v) => { store.set('games:sound', !v); return !v; }), []);
  const fx = useMemo(() => ({
    play: (name) => on && SOUNDS[name]?.(),
    voice: (name) => on && playVoice(name),
  }), [on]);
  return [fx, on, toggle];
}

export function SoundToggle({ on, toggle }) {
  return (
    <button className="icon-btn" type="button" aria-pressed={on} onClick={toggle} aria-label={on ? '소리 끄기' : '소리 켜기'} title={on ? '소리 끄기' : '소리 켜기'}>
      {on ? '🔊' : '🔇'}
    </button>
  );
}
