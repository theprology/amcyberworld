import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AgentPortal from '../app/agent/AgentPortal';
import '../app/globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AgentPortal />
  </StrictMode>,
);
