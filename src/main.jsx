import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import './index.css'

/**
 * TanStack Query's cache is not a convenience here, it is how the item list becomes instant. An
 * item that has been scanned once in this shift should appear without a round trip.
 *
 * retry: 1 rather than the default 3. At a counter, three silent retries is three seconds of a
 * cashier not knowing whether anything happened. One retry, then say so.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000
    }
  }
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      {/* Top-centre rather than top-right: on a phone the right corner is under the thumb that
          just pressed something, and a toast there gets dismissed by accident. */}
      <Toaster position="top-center" toastOptions={{ duration: 4000 }} />
    </QueryClientProvider>
  </React.StrictMode>
)
