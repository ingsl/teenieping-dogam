import { NavLink, Link, Outlet, useNavigate, useLocation, useNavigationType } from 'react-router-dom';
import { useEffect } from 'react';
import { loadData } from '../lib/data.js';

function RandomLink() {
  const navigate = useNavigate();
  const go = async (e) => {
    e.preventDefault();
    const { items } = await loadData();
    navigate(`/p/${items[Math.floor(Math.random() * items.length)].id}`);
  };
  return <a href="#random" onClick={go}><span className="ico" aria-hidden="true">🎲</span>랜덤핑</a>;
}

export default function Layout() {
  const location = useLocation();
  const { pathname } = location;
  const navType = useNavigationType();
  // 스크롤 위치: 새 페이지는 맨 위, 뒤로가기(POP)는 보던 위치로 (목록이 그려질 때까지 잠깐 재시도)
  useEffect(() => {
    const key = `scroll:${location.key}`;
    const save = () => { try { sessionStorage.setItem(key, String(window.scrollY)); } catch { /* 무시 */ } };
    if (navType === 'POP') {
      let y = 0;
      try { y = Number(sessionStorage.getItem(key) || 0); } catch { /* 무시 */ }
      let tries = 0;
      const restore = () => {
        window.scrollTo(0, y);
        if (Math.abs(window.scrollY - y) > 2 && tries++ < 20) setTimeout(restore, 50);
      };
      restore();
    } else {
      window.scrollTo(0, 0);
    }
    window.addEventListener('scroll', save, { passive: true });
    return () => { save(); window.removeEventListener('scroll', save); };
  }, [location.key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <header className="site-header">
        <div className="inner">
          <Link className="logo" to="/"><span className="heart">💖</span>티니핑 도감</Link>
          <nav className="site-nav" aria-label="주 메뉴">
            <NavLink to="/" end className={({ isActive }) => (isActive || pathname.startsWith('/p/') ? 'active' : '')}><span className="ico" aria-hidden="true">📖</span>도감</NavLink>
            <NavLink to="/games"><span className="ico" aria-hidden="true">🎮</span>게임</NavLink>
            <RandomLink />
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="inner">
          <p><strong>비공식·비영리 팬 페이지</strong>입니다. 광고·후원·판매 등 어떠한 수익화도 하지 않습니다.</p>
          <p>'캐치! 티니핑' 캐릭터의 이름·이미지 등 모든 권리는 <strong>SAMG엔터테인먼트</strong>에 있습니다.</p>
          <p>
            캐릭터 정보 출처: <a href="https://namu.wiki/" rel="noopener">나무위키</a> (
            <a href="https://creativecommons.org/licenses/by-nc-sa/2.0/kr/" rel="noopener license">CC BY-NC-SA 2.0 KR</a>),{' '}
            <a href="https://catchteenieping.fandom.com/" rel="noopener">Catch! Teenieping Wiki (Fandom)</a> (
            <a href="https://creativecommons.org/licenses/by-sa/3.0/" rel="noopener license">CC BY-SA 3.0</a>). 각 상세 페이지에 원문 링크가 있습니다.
          </p>
        </div>
      </footer>
    </>
  );
}
