import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import SplashScreen from './components/SplashScreen';
import SetupPage from './pages/SetupPage';
import DashboardPage from './pages/DashboardPage';
import RecordingsPage from './pages/RecordingsPage';
import ModelsPage from './pages/ModelsPage';
import SettingsPage from './pages/SettingsPage';
import PillPage from './pages/PillPage';

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Listen for navigation events from main process
    const unsubscribeNavigate = window.electronAPI?.navigation?.onNavigate((route) => {
      navigate(route);
    });

    return () => {
      if (unsubscribeNavigate) unsubscribeNavigate();
    };
  }, [navigate]);

  useEffect(() => {
    // Show splash screen only on first load and not on pill route
    if (isFirstLoad && !location.pathname.includes('pill')) {
      const timer = setTimeout(() => {
        setShowSplash(false);
        setIsFirstLoad(false);
      }, 2000);

      return () => clearTimeout(timer);
    } else {
      setShowSplash(false);
    }
  }, [isFirstLoad, location.pathname]);

  // Show splash screen for first load
  if (showSplash && !location.pathname.includes('pill')) {
    return <SplashScreen />;
  }

  return (
    <div className="App">
      <Toaster position="top-right" />
      
      <Routes>
        {/* Pill route - separate from main app */}
        <Route path="/pill" element={<PillPage />} />
        
        {/* Main app routes with layout */}
        <Route path="/" element={<Layout />}>
          <Route path="setup" element={<SetupPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="recordings" element={<RecordingsPage />} />
          <Route path="models" element={<ModelsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route index element={<DashboardPage />} />
        </Route>
      </Routes>
    </div>
  );
}

export default App;