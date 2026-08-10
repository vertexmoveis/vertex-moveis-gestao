'use client'

import { useEffect } from 'react'

export function PublicProposalScrollReset() {
  useEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration
    let userInteracted = false
    let animationFrame = 0

    window.history.scrollRestoration = 'manual'

    if (window.location.hash) {
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${window.location.search}`,
      )
    }

    const markInteraction = () => {
      userInteracted = true
    }

    const scrollToTop = () => {
      if (!userInteracted) window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    }

    scrollToTop()
    animationFrame = window.requestAnimationFrame(scrollToTop)

    const delayedReset = window.setTimeout(scrollToTop, 600)

    window.addEventListener('pageshow', scrollToTop)
    window.addEventListener('pointerdown', markInteraction, { passive: true })
    window.addEventListener('touchstart', markInteraction, { passive: true })
    window.addEventListener('wheel', markInteraction, { passive: true })
    window.addEventListener('keydown', markInteraction)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.clearTimeout(delayedReset)
      window.removeEventListener('pageshow', scrollToTop)
      window.removeEventListener('pointerdown', markInteraction)
      window.removeEventListener('touchstart', markInteraction)
      window.removeEventListener('wheel', markInteraction)
      window.removeEventListener('keydown', markInteraction)
      window.history.scrollRestoration = previousScrollRestoration
    }
  }, [])

  return null
}
