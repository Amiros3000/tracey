import Link from 'next/link'
import TraceyLogo from '@/components/TraceyLogo'

export const metadata = { title: 'Privacy Policy — tracey' }

export default function PrivacyPage() {
  return (
    <div style={{ backgroundColor: 'var(--bg)', minHeight: '100dvh' }}>
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', maxWidth: 720, margin: '0 auto' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <TraceyLogo size="sm" />
        </Link>
        <Link href="/login" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', textDecoration: 'none' }}>
          Sign in
        </Link>
      </nav>

      <article style={{ maxWidth: 680, margin: '0 auto', padding: '40px 24px 80px' }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8, letterSpacing: '-0.02em' }}>
          Privacy Policy
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 40 }}>
          Last updated: May 30, 2026
        </p>

        <Section title="The short version">
          <p>Your financial data lives on the server you (or the person who invited you) chose. We never see it, sell it, or share it. The only external service that receives any of your data is Anthropic — and only when you use AI features, only the financial context needed to generate your insights.</p>
        </Section>

        <Section title="What data we store">
          <p>tracey stores the following on your server:</p>
          <ul>
            <li>Your username and hashed password (bcrypt — we cannot reverse it)</li>
            <li>Account names, types, and balances you enter manually</li>
            <li>Expense and income transactions you log or import</li>
            <li>Pay cycle settings and preferences</li>
            <li>Session tokens (hashed in the database, expire in 7 days)</li>
          </ul>
          <p>All data is encrypted at rest using SQLCipher with a key only the server operator holds.</p>
        </Section>

        <Section title="What we do NOT do">
          <ul>
            <li>We never connect to your bank directly</li>
            <li>We never sell, rent, or share your data with advertisers or data brokers</li>
            <li>We do not run analytics or telemetry on your usage</li>
            <li>We do not store your data on our servers — tracey is self-hosted</li>
          </ul>
        </Section>

        <Section title="AI features (tracey thinks)">
          <p>tracey uses AI to power three features. Each routes to a different provider depending on the task:</p>
          <ul>
            <li><strong>Dashboard insights ("tracey thinks")</strong> — a summary of your spending, income, and account data is sent to Google Gemini via OpenRouter. This includes aggregated category totals and your pay cycle, but never raw transaction notes or account numbers.</li>
            <li><strong>Product & rewards lookup</strong> — your query is sent to DeepSeek via OpenRouter. No personal financial data is included.</li>
            <li><strong>AI chat</strong> — messages are sent to Claude (Anthropic) directly, along with the financial context you ask it to consider.</li>
          </ul>
          <p>All AI requests are sent over HTTPS. None of the providers we use train on API request data by default. AI features are entirely optional — if you don't use them, none of your data is ever sent externally.</p>
          <p>Relevant privacy policies: <a href="https://openrouter.ai/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>OpenRouter</a> · <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>Google</a> · <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>Anthropic</a></p>
        </Section>

        <Section title="PDF and CSV import">
          <p>When you upload a bank statement PDF, tracey first attempts to extract the text locally on the server (no external service involved). If the PDF is a scanned image and text extraction fails, the file content is sent to Google Gemini via OpenRouter for parsing. The file is processed in memory and not stored after the response is returned.</p>
          <p>CSVs are parsed entirely on the server — no external service is ever involved.</p>
        </Section>

        <Section title="Who controls your data">
          <p>If you are running tracey on your own server: you control everything. You can delete your account and all associated data at any time from Settings → Delete all data.</p>
          <p>If you are using a tracey instance hosted by someone else (e.g. a friend who invited you): that person is the server operator and technically has access to the database. Only use hosted instances run by people you trust.</p>
        </Section>

        <Section title="Cookies and local storage">
          <p>tracey stores your authentication token in your browser's <code>localStorage</code>. No third-party cookies are used. No tracking pixels or analytics scripts are loaded.</p>
        </Section>

        <Section title="Changes to this policy">
          <p>If this policy changes materially, we will update the "last updated" date at the top. For significant changes, we will make reasonable efforts to notify users through the app.</p>
        </Section>

        <Section title="Contact">
          <p>Questions about this policy? Reach out at <a href="mailto:amir.ibrahim3000@gmail.com" style={{ color: 'var(--primary)' }}>amir.ibrahim3000@gmail.com</a>.</p>
        </Section>
      </article>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 36 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, letterSpacing: '-0.01em' }}>
        {title}
      </h2>
      <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {children}
      </div>
    </section>
  )
}
