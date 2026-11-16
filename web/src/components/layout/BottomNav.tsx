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
    <nav className="md:hidden flex items-center justify-around h-14 bg-surface-deepest border-t border-hairline px-2 z-40 shrink-0 select-none">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 px-3 rounded-control text-xs font-normal transition-colors duration-150 ${
                isActive ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary'
              }`
            }
          >
            <Icon className="w-4 h-4 mb-1" />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
};
