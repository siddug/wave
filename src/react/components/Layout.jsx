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
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-sm border-r border-gray-200 flex flex-col">
        {/* App Branding */}
        <div className="px-6 pt-8 pb-6 mt-6">
          <div className="flex items-center space-x-3">
            <img
              src={logoImage}
              alt="Wave Logo"
              className="w-10 h-10 object-contain"
            />
            <div className="flex flex-col">
              <span className="text-lg font-semibold text-gray-900">Wave</span>
              <div className="text-xs text-gray-400 mt-0">
                Made with ❤️ by <a href="https://siddg.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600 hover:underline">siddg.com</a>
              </div>
            </div>
          </div>
        </div>

        <nav className="px-6 flex-1">
          <div className="space-y-0.5">
            {navItems.map(({ path, label }) => {
              const isActive = location.pathname === path || 
                              (path === '/dashboard' && location.pathname === '/');
              
              return (
                <Link
                  key={path}
                  to={path}
                  className={`
                    block px-4 py-1 text-sm font-normal rounded-lg transition-colors
                    ${isActive 
                      ? 'bg-gray-100 text-gray-900 font-medium' 
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
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
        <div className="h-4"></div>
      </div>
      
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-auto bg-white">
          <div className="">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;