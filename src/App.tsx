import { NavLink, Route, Routes } from 'react-router-dom';
import Builder from './pages/Builder';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Teacher from './pages/Teacher';

const link = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 rounded-full text-sm font-bold transition ${isActive ? 'bg-white text-indigo-950' : 'text-indigo-100 hover:bg-white/10'}`;

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-indigo-950 text-white">
        <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center gap-4">
          <NavLink to="/" className="flex items-center gap-2 mr-auto">
            <span className="grid place-items-center w-8 h-8 rounded-lg bg-gradient-to-br from-amber-300 to-pink-400 text-lg">🧩</span>
            <span className="font-display text-xl font-extrabold tracking-tight">Safeguard Studio</span>
          </NavLink>
          <nav className="flex gap-1">
            <NavLink to="/" end className={link}>Challenges</NavLink>
            <NavLink to="/profile" className={link}>My profile</NavLink>
            <NavLink to="/teacher" className={link}>Teacher view</NavLink>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/build/:id" element={<Builder />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/teacher" element={<Teacher />} />
        </Routes>
      </main>
    </div>
  );
}
