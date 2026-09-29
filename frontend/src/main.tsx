import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { initScrollbarAutoFade } from './lib/scrollbarAutoFade';
import './index.css';

initScrollbarAutoFade();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
