import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { ErrorBoundary, ToastProvider } from './components/common'
import './index.css'

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => {
        const updateInterval = 60 * 60 * 1000
        let lastCheckAt = Date.now()

        const checkForUpdate = () => {
          lastCheckAt = Date.now()
          void registration.update().catch((error) => {
            console.info('Service-worker update check skipped:', error)
          })
        }

        window.setInterval(checkForUpdate, updateInterval)
        document.addEventListener('visibilitychange', () => {
          const checkIsDue = Date.now() - lastCheckAt >= updateInterval
          if (document.visibilityState === 'visible' && checkIsDue) checkForUpdate()
        })
      })
      .catch((error) => {
        console.info('Service-worker registration failed:', error)
      })
  })
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
