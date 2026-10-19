import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AmcyberworldApp from '../app/AmcyberworldApp';
import '../app/globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AmcyberworldApp />
  </StrictMode>,
);
