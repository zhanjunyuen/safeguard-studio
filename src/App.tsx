import { BookOpen, ChartNoAxesColumn, ClipboardCheck, Presentation } from 'lucide-react';
import { useEffect } from 'react';
import { Navigate, NavLink, Route, Routes, useParams } from 'react-router-dom';
import PresenterBar from './components/PresenterBar';
import { usePresenter } from './store/presenter';
import Breaker from './pages/Breaker';
import Builder from './pages/Builder';
import Home from './pages/Home';
import Mission from './pages/Mission';
import Profile from './pages/Profile';
import Teacher from './pages/Teacher';

const link = ({ isActive }: { isActive: boolean }) =>
  `studio-nav-link ${isActive ? 'is-active' : ''}`;

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
  const { id, level } = useParams();
  return <Builder key={`${id}-${level ?? 1}`} />;
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
      <button className="skip-to-content" onClick={() => document.getElementById('main-content')?.focus()}>Skip to content</button>
      <header className="studio-header">
        <div className="studio-header-inner">
          <NavLink to="/" className="studio-brand">
            <Logo />
            <span className="font-display text-xl font-extrabold">Safeguard Studio</span>
          </NavLink>
          <nav className="studio-nav" aria-label="Main">
            <NavLink to="/" end className={link}><BookOpen size={16} aria-hidden />Challenges</NavLink>
            {!presenting && <NavLink to="/mission" className={link}><ClipboardCheck size={16} aria-hidden />Assessment</NavLink>}
            <NavLink to="/profile" className={link}><ChartNoAxesColumn size={16} aria-hidden />My results</NavLink>
            <NavLink to="/teacher" className={link}><Presentation size={16} aria-hidden />Teacher view</NavLink>
          </nav>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className={`flex-1 ${presenting ? 'pb-28' : ''}`}>
        <Routes key={presenting ? 'demo' : 'pupil'}>
          <Route path="/" element={<Home />} />
          <Route path="/mission" element={presenting ? <Navigate to="/" replace /> : <Mission />} />
          <Route path="/build/:id/:level?" element={<BuilderRoute />} />
          <Route path="/break/:id" element={<BreakerRoute />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/teacher" element={<Teacher />} />
          <Route path="/present" element={<PresentRoute />} />
          <Route path="/challenges" element={<Home scrollTo="challenges" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <PresenterBar />
    </div>
  );
}
