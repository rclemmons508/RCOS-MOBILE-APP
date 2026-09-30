import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './context/AuthContext.tsx';
import { BiometricProvider } from './context/BiometricContext.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <BiometricProvider>
          <App />
        </BiometricProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);
