'use client'

import { useState, useRef, useEffect } from 'react'
import { api } from '@/lib/api'
import TraceyLogo from '@/components/TraceyLogo'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const STARTERS = [
  "Am I on track this month?",
  "How can I pay off my loans faster?",
  "Where am I overspending?",
  "What's my biggest financial risk right now?",
]

export default function AIPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(text?: string) {
    const content = (text || input).trim()
    if (!content || loading) return

    const userMsg: Message = { role: 'user', content, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await api.post<{ reply: string }>('/ai/chat', {
        message: content,
        history: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
      })
      setMessages(prev => [...prev, { role: 'assistant', content: res.reply, timestamp: new Date() }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Sorry, I couldn't connect right now. Make sure the backend is running and your API key is set.",
        timestamp: new Date(),
      }])
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="ai-chat-shell" style={{ display: 'flex', flexDirection: 'column', maxWidth: 680, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: 'var(--primary-light-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 18 }}>✨</span>
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>AI Money Guide</p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Powered by Claude · knows your finances</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {isEmpty && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 20 }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 32, marginBottom: 8 }}>✨</p>
              <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Ask me anything about your money</p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>I have full context on your accounts, spending, income, and loans.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
              {STARTERS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 12,
                    border: '1.5px solid var(--border)',
                    backgroundColor: 'var(--card)',
                    color: 'var(--text-primary)',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'Nunito, sans-serif',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '82%',
                padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                backgroundColor: msg.role === 'user' ? 'var(--primary)' : 'var(--surface)',
                color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                fontSize: 14,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ backgroundColor: 'var(--surface)', borderRadius: '18px 18px 18px 4px', padding: '12px 16px', display: 'flex', gap: 4, alignItems: 'center' }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--text-secondary)', animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
              <style>{`@keyframes pulse { 0%,80%,100%{opacity:0.3} 40%{opacity:1} }`}</style>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '10px 12px 12px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about your finances…"
            disabled={loading}
            style={{ flex: 1, borderRadius: 20, padding: '10px 16px', fontSize: 14 }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            style={{
              width: 40, height: 40, borderRadius: '50%',
              backgroundColor: input.trim() && !loading ? 'var(--primary)' : 'var(--surface)',
              border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, flexShrink: 0,
              transition: 'background-color 0.15s',
            }}
          >
            {loading ? (
              <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--text-secondary)', borderTopColor: 'transparent', animation: 'spin 0.6s linear infinite' }} />
            ) : (
              <span style={{ color: input.trim() ? 'white' : 'var(--text-secondary)' }}>↑</span>
            )}
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center', marginTop: 8 }}>
          Claude sees your real numbers — keep context private
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}
