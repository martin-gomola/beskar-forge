import { useEffect } from 'react'

/**
 * Set document.title for the current view.
 *
 * In standalone PWA mode this title is user-visible chrome (app switcher
 * card, desktop window title, mini-mode), not just SEO. Default Vite
 * leaves it frozen at the build-time placeholder, which makes the app-
 * switcher card read identically across every route.
 *
 * Restores the previous title on unmount so deep-link → route-switch →
 * back-button leaves the document in a sane state.
 *
 * Usage in a multi-route SPA:
 *   useDocumentTitle('App · Settings')
 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const previous = document.title
    document.title = title
    return () => {
      document.title = previous
    }
  }, [title])
}
