import { NavLink, Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { loadData } from '../lib/data.js';

function RandomLink() {
  const navigate = useNavigate();
  const go = async (e) => {
    e.preventDefault();
    const { items } = await loadData();
    navigate(`/p/${items[Math.floor(Math.random() * items.length)].id}`);
  };
  return <a href="#random" onClick={go}>랜덤핑</a>;
}

export default function Layout() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  return (
    <>
      <header className="site-header">
        <div className="inner">
          <Link className="logo" to="/"><span className="heart">💖</span>티니핑 도감</Link>
          <nav className="site-nav" aria-label="주 메뉴">
            <NavLink to="/" end className={({ isActive }) => (isActive || pathname.startsWith('/p/') ? 'active' : '')}>도감</NavLink>
            <NavLink to="/games">게임</NavLink>
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
