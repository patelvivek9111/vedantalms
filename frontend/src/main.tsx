import './instrument';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/700.css';
import App from './App';
import './index.css';
import { clearChunkReloadFlag } from './utils/lazyWithRetry';

clearChunkReloadFlag();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
    <App />
    </BrowserRouter>
  </React.StrictMode>
); 