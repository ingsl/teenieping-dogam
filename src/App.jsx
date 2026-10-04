import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Dogam from './pages/Dogam.jsx';
import Detail from './pages/Detail.jsx';
import Games from './pages/Games.jsx';
import Memory from './pages/Memory.jsx';
import Puzzle from './pages/Puzzle.jsx';
import Quiz from './pages/Quiz.jsx';
import Shadow from './pages/Shadow.jsx';
import Catch from './pages/Catch.jsx';
import Pang from './pages/Pang.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dogam />} />
        <Route path="p/:id" element={<Detail />} />
        <Route path="games" element={<Games />} />
        <Route path="games/memory" element={<Memory />} />
        <Route path="games/puzzle" element={<Puzzle />} />
        <Route path="games/quiz" element={<Quiz />} />
        <Route path="games/shadow" element={<Shadow />} />
        <Route path="games/catch" element={<Catch />} />
        <Route path="games/pang" element={<Pang />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
