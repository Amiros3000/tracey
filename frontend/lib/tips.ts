import { useState, useEffect } from 'react'

export function useTip(key: string) {
  const storageKey = `tracey_tip_${key}`
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem(storageKey)) {
      setVisible(true)
    }
  }, [storageKey])

  function dismiss() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, '1')
    }
    setVisible(false)
  }

  return { visible, dismiss }
}
