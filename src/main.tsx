import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { connectLiteracyAi } from './engine/aiProviders';

// Use the Adaption AI for marking, follow-ups, hints and the skills summary when the site is built
// with Supabase; otherwise everything stays on the offline markers.
connectLiteracyAi();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
