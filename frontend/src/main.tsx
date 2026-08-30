import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { ErrorBoundary, ToastProvider } from './components/common'
import { startUpdateLifecycle } from './platform/updateLifecycle'
import './index.css'

if (import.meta.env.PROD) {
  window.addEventListener('load', startUpdateLifecycle)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
