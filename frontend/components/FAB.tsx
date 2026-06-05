'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const OPTIONS = [
  {
    label: 'Import statement',
    color: '#6366f1',
    shadow: 'rgba(99,102,241,0.3)',
    href: '/accounts?import=1',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"
          stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: 'Income',
    color: 'var(--success)',
    shadow: 'rgba(34,197,94,0.35)',
    href: '/log?type=income',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <line x1="12" y1="20" x2="12" y2="4" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="4" y1="12" x2="20" y2="12" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'Expense',
    color: 'var(--danger)',
    shadow: 'rgba(239,68,68,0.3)',
    href: '/log?type=expense',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <line x1="12" y1="20" x2="12" y2="4" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="4" y1="12" x2="20" y2="12" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },
]

export default function FAB() {
  const [open, setOpen]       = useState(false)
  const [closing, setClosing] = useState(false)
  const router = useRouter()

  // After close animation completes, fully unmount items
  useEffect(() => {
    if (!closing) return
    const t = setTimeout(() => { setOpen(false); setClosing(false) }, 280)
    return () => clearTimeout(t)
  }, [closing])

  function handleOpen()  { setOpen(true) }
  function handleClose() { if (open && !closing) setClosing(true) }
  function toggle()      { open ? handleClose() : handleOpen() }

  function go(href: string) {
    handleClose()
    setTimeout(() => router.push(href), 140) // wait halfway through close
  }

  // Items rendered bottom-to-top (Expense closest to button)
  const reversedOptions = [...OPTIONS].reverse()

  return (
    <>
      <style>{`
        /* Open — pop in from button upward, staggered bottom-to-top */
        @keyframes fabIn {
          0%   { opacity: 0; transform: scale(0.55) translateY(14px); }
          65%  { transform: scale(1.06) translateY(-3px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        /* Close — shrink back toward button, staggered top-to-bottom */
        @keyframes fabOut {
          0%   { opacity: 1; transform: scale(1) translateY(0); }
          100% { opacity: 0; transform: scale(0.55) translateY(14px); }
        }
        .fab-in-0  { animation: fabIn  0.24s cubic-bezier(0.34,1.56,0.64,1) 0ms   both; }
        .fab-in-1  { animation: fabIn  0.24s cubic-bezier(0.34,1.56,0.64,1) 60ms  both; }
        .fab-in-2  { animation: fabIn  0.24s cubic-bezier(0.34,1.56,0.64,1) 120ms both; }
        .fab-out-0 { animation: fabOut 0.16s ease-in 0ms   both; }
        .fab-out-1 { animation: fabOut 0.16s ease-in 50ms  both; }
        .fab-out-2 { animation: fabOut 0.16s ease-in 100ms both; }
      `}</style>

      {(open || closing) && (
        <div onClick={handleClose} style={{ position: 'fixed', inset: 0, zIndex: 58 }} />
      )}

      <div style={{
        position: 'fixed',
        bottom: 'calc(var(--bottom-nav-height) + 16px)',
        right: 20,
        zIndex: 59,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 12,
      }}>

        {(open || closing) && reversedOptions.map((opt, i) => (
          <button
            key={opt.label}
            onClick={() => go(opt.href)}
            className={closing ? `fab-out-${i}` : `fab-in-${i}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            }}
          >
            <span style={{
              backgroundColor: 'var(--card)', borderRadius: 10,
              padding: '9px 16px', fontWeight: 700, fontSize: 14,
              boxShadow: '0 2px 16px rgba(0,0,0,0.18)',
              color: 'var(--text-primary)', whiteSpace: 'nowrap',
              fontFamily: 'Nunito, sans-serif',
            }}>
              {opt.label}
            </span>
            <div style={{
              width: 46, height: 46, borderRadius: '50%',
              backgroundColor: opt.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 16px ${opt.shadow}`, flexShrink: 0,
            }}>
              {opt.icon}
            </div>
          </button>
        ))}

        <button
          onClick={toggle}
          aria-label="Log transaction"
          style={{
            width: 56, height: 56, borderRadius: '50%',
            backgroundColor: 'var(--primary)',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: (open && !closing) ? '0 6px 32px rgba(34,197,94,0.55)' : '0 4px 24px rgba(34,197,94,0.45)',
            transform: (open && !closing) ? 'rotate(45deg)' : 'rotate(0deg)',
            transition: 'transform 0.22s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.15s ease',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <line x1="12" y1="4" x2="12" y2="20" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="4" y1="12" x2="20" y2="12" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </>
  )
}
