import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './App.css';
import App from './App.js';
import React from 'react';

// import { Chore } from '@types/index';

const root = document.getElementById('root'); 

if (root !== null) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
