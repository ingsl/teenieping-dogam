// 게임 효과음(Web Audio, 파일 없음) · 이름 읽어주기(Web Speech) — 브라우저가 지원하지 않으면 조용히 무시
import { useCallback, useState } from 'react';
import { store } from './data.js';

let ctx;
function tone(freq, start, dur, type = 'sine', gain = 0.12) {
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain, ctx.currentTime + start);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
    o.connect(g).connect(ctx.destination);
    o.start(ctx.currentTime + start);
    o.stop(ctx.currentTime + start + dur);
  } catch { /* 소리 없이 진행 */ }
}

const SOUNDS = {
  good: () => { tone(660, 0, 0.12); tone(880, 0.1, 0.18); },
  bad: () => { tone(220, 0, 0.18, 'triangle'); tone(180, 0.12, 0.22, 'triangle'); },
  pop: () => tone(900 + Math.random() * 400, 0, 0.08, 'square', 0.06),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.25)),
  tick: () => tone(1200, 0, 0.03, 'square', 0.03),
};

function say(text) {
  try {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR';
    u.rate = 0.95;
    u.pitch = 1.2;
    speechSynthesis.speak(u);
  } catch { /* 무시 */ }
}

/** [fx, soundOn, toggle] — fx.play('good'), fx.say('하츄핑!') */
export function useFx() {
  const [on, setOn] = useState(() => store.get('games:sound', true));
  const toggle = useCallback(() => setOn((v) => { store.set('games:sound', !v); return !v; }), []);
  const fx = {
    play: (name) => on && SOUNDS[name]?.(),
    say: (text) => on && say(text),
  };
  return [fx, on, toggle];
}

export function SoundToggle({ on, toggle }) {
  return (
    <button className="btn ghost" type="button" aria-pressed={on} onClick={toggle}>
      {on ? '🔊 소리 켜짐' : '🔈 소리 꺼짐'}
    </button>
  );
}
