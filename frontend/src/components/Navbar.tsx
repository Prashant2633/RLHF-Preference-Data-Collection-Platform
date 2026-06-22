import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { auth, isMock } from '../firebase';
import { Activity, Database, AlertCircle, FileDown, LogOut, ShieldAlert } from 'lucide-react';

interface NavbarProps {
  user: any | null;
}

export const Navbar: React.FC<NavbarProps> = ({ user }) => {
  const location = useLocation();
  
  if (!user) return null;

  const isActive = (path: string) => location.pathname === path;
  
  const navLinkClass = (path: string) => `
    flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-mono transition-all duration-200 border
    ${isActive(path) 
      ? 'bg-accentA/10 text-accentA border-accentA/20 font-bold glow-amber' 
      : 'bg-transparent text-textMuted border-transparent hover:text-textWarm hover:border-cardBorder'
    }
  `;

  return (
    <nav className="bg-[#1b1920] border-b border-cardBorder sticky top-0 z-40 px-6 py-3 flex items-center justify-between">
      {/* Brand logo */}
      <Link to="/" className="flex items-center gap-2 group">
        <div className="w-8 h-8 rounded-lg bg-accentA flex items-center justify-center font-bold text-black font-serif text-lg group-hover:shadow-[0_0_12px_rgba(255,122,51,0.5)] transition-shadow">
          Ω
        </div>
        <div>
          <span className="font-serif font-bold text-textWarm block leading-none">RLHF Platform</span>
          <span className="text-[9px] font-mono text-textMuted uppercase tracking-wider">Preference Calibration</span>
        </div>
      </Link>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        <Link to="/" className={navLinkClass('/')}>
          <Activity className="w-4 h-4" />
          <span>Annotate</span>
        </Link>
        
        <Link to="/tasks" className={navLinkClass('/tasks')}>
          <Database className="w-4 h-4" />
          <span>Tasks</span>
        </Link>
        
        <Link to="/calibration" className={navLinkClass('/calibration')}>
          <AlertCircle className="w-4 h-4" />
          <span>Calibration</span>
        </Link>
        
        <Link to="/export" className={navLinkClass('/export')}>
          <FileDown className="w-4 h-4" />
          <span>Export</span>
        </Link>
      </div>

      {/* User Status / Logout */}
      <div className="flex items-center gap-4">
        {/* Role badge */}
        <div className="flex flex-col text-right">
          <span className="text-xs font-semibold text-textWarm">{user.displayName || user.email}</span>
          <span className="text-[9px] font-mono text-accentB uppercase tracking-widest mt-0.5 flex items-center justify-end gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-accentB"></span>
            {user.role || 'annotator'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => auth.signOut()}
          className="p-2 rounded-lg bg-[#222026] border border-cardBorder text-textMuted hover:text-brandRed hover:border-brandRed/30 transition-all"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
};
