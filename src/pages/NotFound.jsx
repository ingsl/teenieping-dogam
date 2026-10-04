import { Link } from 'react-router-dom';
import { useTitle } from '../lib/data.js';

export default function NotFound() {
  useTitle('페이지 없음');
  return (
    <div className="empty">
      <h1>앗, 없는 페이지예요</h1>
      <p><Link className="btn" to="/">도감으로 가기</Link></p>
    </div>
  );
}
