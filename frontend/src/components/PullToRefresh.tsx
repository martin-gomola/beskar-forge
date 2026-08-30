import { useEffect, useRef, useState, type ReactNode } from 'react'

const REFRESH_THRESHOLD = 72
const MAX_PULL_DISTANCE = 104

type PullPhase = 'idle' | 'pulling' | 'ready' | 'refreshing'

interface PullToRefreshProps {
  children: ReactNode
  disabled?: boolean
  onRefresh: () => Promise<void>
}

interface TouchGesture {
  startX: number
  startY: number
  distance: number
  pulling: boolean
}

function getScrollTop() {
  return window.scrollY || document.documentElement.scrollTop
}

export function PullToRefresh({ children, disabled = false, onRefresh }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0)
  const [phase, setPhase] = useState<PullPhase>('idle')
  const [announcement, setAnnouncement] = useState('')
  const gestureRef = useRef<TouchGesture | null>(null)
  const resetTimerRef = useRef<number | null>(null)
  const phaseRef = useRef<PullPhase>('idle')

  useEffect(() => {
    const setCurrentPhase = (nextPhase: PullPhase) => {
      phaseRef.current = nextPhase
      setPhase(nextPhase)
    }

    const reset = () => {
      gestureRef.current = null
      setPullDistance(0)
      setCurrentPhase('idle')
    }

    const handleTouchStart = (event: TouchEvent) => {
      if (
        disabled ||
        phaseRef.current === 'refreshing' ||
        event.touches.length !== 1 ||
        getScrollTop() > 0
      ) return

      const touch = event.touches[0]
      gestureRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        distance: 0,
        pulling: false,
      }
    }

    const handleTouchMove = (event: TouchEvent) => {
      const gesture = gestureRef.current
      if (!gesture || event.touches.length !== 1) return

      const touch = event.touches[0]
      const deltaX = touch.clientX - gesture.startX
      const deltaY = touch.clientY - gesture.startY
      if (getScrollTop() > 0 || deltaY <= 0 || Math.abs(deltaX) > Math.abs(deltaY)) {
        reset()
        return
      }

      const distance = Math.min(deltaY * 0.5, MAX_PULL_DISTANCE)
      if (distance < 4) return

      event.preventDefault()
      gesture.distance = distance
      gesture.pulling = true
      setPullDistance(distance)
      setCurrentPhase(distance >= REFRESH_THRESHOLD ? 'ready' : 'pulling')
      setAnnouncement(
        distance >= REFRESH_THRESHOLD
          ? 'Release to check for updates.'
          : 'Keep pulling to check for updates.',
      )
    }

    const handleTouchEnd = () => {
      const gesture = gestureRef.current
      gestureRef.current = null
      if (!gesture?.pulling) {
        reset()
        return
      }

      if (gesture.distance < REFRESH_THRESHOLD || disabled) {
        reset()
        setAnnouncement('Update check cancelled.')
        return
      }

      setPullDistance(REFRESH_THRESHOLD)
      setCurrentPhase('refreshing')
      setAnnouncement('Checking for updates…')
      void onRefresh()
        .catch(() => undefined)
        .finally(() => {
          setAnnouncement('Update check complete.')
          setPullDistance(0)
          setCurrentPhase('idle')
          if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current)
          resetTimerRef.current = window.setTimeout(() => setAnnouncement(''), 1_000)
        })
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })
    document.addEventListener('touchcancel', reset, { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
      document.removeEventListener('touchcancel', reset)
      if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current)
    }
  }, [disabled, onRefresh])

  const indicatorVisible = pullDistance > 0
  const indicatorLabel = phase === 'refreshing'
    ? 'Checking for updates…'
    : phase === 'ready'
      ? 'Release to check for updates'
      : 'Pull to check for updates'

  return (
    <div className="pull-to-refresh">
      <div
        className={`pull-to-refresh-indicator pull-to-refresh-${phase}`}
        aria-hidden={!indicatorVisible}
        style={{ height: `${pullDistance}px` }}
      >
        <span className="pull-to-refresh-icon" aria-hidden="true">{phase === 'refreshing' ? '↻' : '↓'}</span>
        <span>{indicatorLabel}</span>
      </div>
      <div className="sr-only" role="status" aria-live="polite">{announcement}</div>
      {children}
    </div>
  )
}
