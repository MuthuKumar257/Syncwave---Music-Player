import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Compass, Library, Calendar, User } from 'lucide-react';

export const BottomNav: React.FC = () => {
  const navItems = [
    { label: 'Home', icon: Home, path: '/' },
    { label: 'Discover', icon: Compass, path: '/discover' },
    { label: 'Library', icon: Library, path: '/library' },
    { label: 'Scheduler', icon: Calendar, path: '/scheduler' },
    { label: 'Profile', icon: User, path: '/profile' }
  ];

  return (
    <nav
      aria-label="Mobile navigation"
      className="md:hidden flex items-center justify-around h-14 bg-surface-deepest/95 backdrop-blur-md border-t border-hairline px-1 z-40 shrink-0 select-none pb-[max(env(safe-area-inset-bottom,0px),4px)]"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-1 rounded-control text-[10px] transition-colors duration-150 min-h-[48px] tap-press ${
                isActive ? 'text-accent font-semibold' : 'text-text-muted hover:text-text-secondary font-medium'
              }`
            }
          >
            <Icon className="w-4 h-4 mb-0.5" />
            <span className="leading-tight">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
};
