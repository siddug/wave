import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import logoImage from '../assets/logo.png';

const Layout = () => {
  const location = useLocation();
  
  // Show sidebar on all pages now

  const navItems = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/models', label: 'Models' },
    { path: '/recordings', label: 'Recordings' },
    { path: '/settings', label: 'Settings' },
  ];

  return (
    <div className="flex h-screen bg-bg-primary-light dark:bg-bg-primary-dark transition-colors duration-fast">
      {/* Sidebar */}
      <div className="w-64 bg-bg-surface-light dark:bg-bg-surface-dark shadow-sm border-r border-border-light-light dark:border-border-light-dark flex flex-col transition-colors duration-fast">
        {/* App Branding */}
        <div className="px-xxxxl pt-xxxxl pb-xxxl mt-xxxl">
          <div className="flex items-center gap-lg">
            {/* <img
              src={logoImage}
              alt="Wave Logo"
              className="w-10 h-10 object-contain"
            /> */}
            <div className="flex flex-col">
              <span className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark transition-colors duration-fast">
                Wave
              </span>
              <div className="text-xs text-text-tertiary-light dark:text-text-tertiary-dark mt-0 transition-colors duration-fast">
                Made with ❤️ by <a href="https://siddg.com" target="_blank" rel="noopener noreferrer" className="text-primary-light dark:text-primary-dark hover:underline transition-colors duration-fast">siddg.com</a>
              </div>
            </div>
          </div>
        </div>

        <nav className="px-xxxl flex-1">
          <div className="space-y-xs">
            {navItems.map(({ path, label }) => {
              const isActive = location.pathname === path ||
                              (path === '/dashboard' && location.pathname === '/');

              return (
                <Link
                  key={path}
                  to={path}
                  className={`
                    block px-xl py-sm text-sm font-normal rounded-md transition-all duration-fast
                    ${isActive
                      ? 'bg-bg-secondary-light dark:bg-bg-secondary-dark text-text-primary-light dark:text-text-primary-dark font-medium'
                      : 'text-text-body-light dark:text-text-body-dark hover:bg-bg-secondary-light/50 dark:hover:bg-bg-secondary-dark/50 hover:text-text-primary-light dark:hover:text-text-primary-dark'
                    }
                  `}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Bottom spacing */}
        <div className="h-xl"></div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-auto bg-bg-primary-light dark:bg-bg-primary-dark transition-colors duration-fast">
          <div className="">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;