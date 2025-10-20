import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import RecordingPill from './components/RecordingPill';
import './index.css';

// Pill-only app entry point
function PillApp() {
  return (
    <HashRouter>
      <div className="w-full h-full bg-transparent">
        <Toaster position="top-center" />
        <RecordingPill />
      </div>
    </HashRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PillApp />
  </React.StrictMode>
);