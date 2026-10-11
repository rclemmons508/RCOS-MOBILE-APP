import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './context/AuthContext.tsx';
import { BiometricProvider } from './context/BiometricContext.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { PublicBookingPage } from './components/PublicBookingPage.tsx';

const root = createRoot(document.getElementById('root')!);

// Customers opening a shared booking link (#/book/:businessId) get the public
// intake form with no login, no operator UI, and no app shell.
if (window.location.hash.startsWith('#/book/')) {
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <PublicBookingPage />
      </ErrorBoundary>
    </StrictMode>,
  );
} else {
  root.render(
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
}
