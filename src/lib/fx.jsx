import { Volume2, VolumeX } from 'lucide-react';
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

/** 음 높이가 미끄러지는 소리 (뿅~, 뾰로롱) */
function glide(from, to, start = 0, dur = 0.2, type = 'triangle', gain = 0.12) {
  try {
    const a = audio();
    const t = a.currentTime + start;
    const o = a.createOscillator();
    const v = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + dur);
    v.gain.setValueAtTime(0.0001, t);
    v.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    v.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(v).connect(a.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  } catch { /* 무시 */ }
}

/** 반짝이 소리: 아주 높은 음을 빠르게 흩뿌림 */
function sparkle(start = 0, count = 6) {
  for (let i = 0; i < count; i++) bell(2200 + Math.random() * 1800, start + i * 0.035, 0.18, 0.025);
}

// 도레미… (C5 기준)
const N = { C5: 523, D5: 587, E5: 659, F5: 698, G5: 784, A5: 880, B5: 988, C6: 1047, D6: 1175, E6: 1319, G6: 1568, C7: 2093, G4: 392, E4: 330 };
const SOUNDS = {
  // 정답: "뾰로롱~ 딩동댕!" 빠르게 올라가는 아르페지오 + 반짝이
  good: () => {
    glide(N.C5, N.C6, 0, 0.12, 'sine', 0.08);
    [N.C6, N.E6, N.G6].forEach((f, i) => bell(f, 0.1 + i * 0.07, 0.4, 0.09));
    bell(N.C7, 0.33, 0.6, 0.06);
    sparkle(0.3, 7);
  },
  // 오답: 슬프지 않게 "뿅~ 뿅" 장난스러운 미끄럼 소리
  bad: () => {
    glide(620, 260, 0, 0.22, 'triangle', 0.13);
    glide(420, 200, 0.2, 0.26, 'triangle', 0.1);
  },
  pop: () => { glide(500, 1400, 0, 0.08, 'sine', 0.09); bell(N.G6, 0.06, 0.15, 0.04); },
  // 클리어: 신나는 팡파르 "빠바바밤~♪" + 반짝이
  win: () => {
    [N.C5, N.E5, N.G5].forEach((f, i) => bell(f, i * 0.1, 0.25, 0.09));
    [N.C6, N.E6].forEach((f) => bell(f, 0.32, 0.25, 0.08));
    [N.D6, N.F5].forEach((f) => bell(f, 0.5, 0.2, 0.07));
    [N.C6, N.E6, N.G6].forEach((f) => bell(f, 0.68, 1.1, 0.08));
    sparkle(0.68, 12);
  },
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
      {on ? <Volume2 size={20} aria-hidden="true" /> : <VolumeX size={20} aria-hidden="true" />}
    </button>
  );
}
