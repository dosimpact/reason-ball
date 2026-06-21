import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

export function mount(container: HTMLElement): () => void {
  const root = createRoot(container);

  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

  return () => {
    root.unmount();
  };
}
