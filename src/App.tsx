import { useEffect } from 'react';
import { Navigate, NavLink, Route, Routes, useParams } from 'react-router-dom';
import PresenterBar from './components/PresenterBar';
import { usePresenter } from './store/presenter';
import Breaker from './pages/Breaker';
import Builder from './pages/Builder';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Teacher from './pages/Teacher';

const link = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 text-[15px] font-bold border-b-[3px] transition-colors ${isActive ? 'border-ink text-ink' : 'border-transparent text-ink-2 hover:text-ink'}`;

function Logo() {
  // a single Scratch-style block as the mark
  return (
    <svg width="34" height="26" viewBox="0 0 34 26" aria-hidden>
      <path d="M0 4 Q0 0 4 0 H8 L11 3 H19 L22 0 H30 Q34 0 34 4 V18 Q34 22 30 22 H22 L19 25 H11 L8 22 H4 Q0 22 0 18 Z" fill="#FFC629" stroke="#16161A" strokeWidth="1.5" />
      <path d="M9 11.5 l3.5 3.5 l7 -7" fill="none" stroke="#16161A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Remount the builder for each challenge so results from one never render against another.
function BuilderRoute() {
  const { id } = useParams();
  return <Builder key={id} />;
}
function BreakerRoute() {
  const { id } = useParams();
  return <Breaker key={id} />;
}

function PresentRoute() {
  useEffect(() => {
    usePresenter.setState({ active: true, step: 0 });
  }, []);
  return <Navigate to="/" replace />;
}

export default function App() {
  const presenting = usePresenter((s) => s.active);
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b-1.5 border-ink bg-paper">
        <div className="max-w-[1400px] mx-auto px-4 h-16 flex items-center gap-4">
          <NavLink to="/" className="flex items-center gap-2.5 mr-auto">
            <Logo />
            <span className="font-display text-xl font-extrabold">Safeguard Studio</span>
          </NavLink>
          <nav className="flex gap-2 self-stretch items-stretch" aria-label="Main">
            <NavLink to="/" end className={link}><span className="flex items-center h-full">Challenges</span></NavLink>
            <NavLink to="/profile" className={link}><span className="flex items-center h-full">My results</span></NavLink>
            <NavLink to="/teacher" className={link}><span className="flex items-center h-full">Teacher view</span></NavLink>
          </nav>
        </div>
      </header>
      <main className={`flex-1 ${presenting ? 'pb-28' : ''}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/build/:id" element={<BuilderRoute />} />
          <Route path="/break/:id" element={<BreakerRoute />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/teacher" element={<Teacher />} />
          <Route path="/present" element={<PresentRoute />} />
        </Routes>
      </main>
      <PresenterBar />
    </div>
  );
}
