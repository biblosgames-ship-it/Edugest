import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Registro y actualización forzada automática de la PWA
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true);
  },
  onRegistered(r) {
    if (r) {
      r.update();
      setInterval(() => {
        r.update();
      }, 30 * 1000);
    }
  }
});

// Crear el cliente de React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos de cache por defecto
      retry: 1
    }
  }
});

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null; info: ErrorInfo | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught an error', error, info);
    this.setState({ info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '2rem',
            backgroundColor: '#fee2e2',
            minHeight: '100vh',
            fontFamily: 'monospace'
          }}
        >
          <h1 style={{ color: '#991b1b', fontSize: '1.5rem', fontWeight: 'bold' }}>
            ¡Algo se rompió en la pantalla! (White Screen Error)
          </h1>
          <pre
            style={{
              marginTop: '1rem',
              backgroundColor: '#f87171',
              padding: '1rem',
              borderRadius: '8px',
              color: '#450a0a',
              overflowX: 'auto'
            }}
          >
            {this.state.error?.toString()}
            {'\n\n'}
            {this.state.info?.componentStack}
          </pre>
          <button
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            style={{
              marginTop: '2rem',
              padding: '0.5rem 1rem',
              backgroundColor: '#dc2626',
              color: 'white',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Limpiar caché y reiniciar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </ErrorBoundary>
);
