import React from 'react';

import { createRoot } from 'react-dom/client';
import { Buffer } from 'buffer';

import './exclude.json';
import './index.css';
import App from './App';

globalThis.Buffer = Buffer;

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
