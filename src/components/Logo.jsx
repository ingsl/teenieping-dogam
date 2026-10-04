/** 사이트 로고: 그라데이션 하트 + 반짝 (이모지 대신 SVG — 어느 기기에서나 같은 모양) */
export default function LogoMark({ size = 30 }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff8cc6" />
          <stop offset="1" stopColor="#e23d86" />
        </linearGradient>
      </defs>
      <path d="M16 28.5C9.2 23.6 3 18.6 3 11.9 3 7.8 6.1 5 9.6 5c2.6 0 4.9 1.5 6.4 3.6C17.5 6.5 19.8 5 22.4 5 25.9 5 29 7.8 29 11.9c0 6.7-6.2 11.7-13 16.6Z" fill="url(#logo-g)" />
      <path d="M9.5 9.3c-1.6.4-2.6 1.7-2.8 3.2" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity=".8" />
      <path d="M25.5 2.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" fill="#ffc94d" />
    </svg>
  );
}
