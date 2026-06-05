import Link from 'next/link'
import TraceyLogo from '@/components/TraceyLogo'

export const metadata = { title: 'Terms of Service — tracey' }

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 40 }}>
          Last updated: May 30, 2026
        </p>

        <Section title="Agreement">
          <p>By creating an account and using tracey, you agree to these terms. If you don't agree, don't use the app.</p>
        </Section>

        <Section title="What tracey is">
          <p>tracey is a personal finance tracking tool. It helps you log expenses, track income, manage account balances, and get AI-generated insights about your spending — all stored on a self-hosted server.</p>
          <p>tracey is a tool to help you understand your money. It is not a bank, a financial institution, an investment advisor, or a licensed financial planner.</p>
        </Section>

        <Section title="Not financial advice">
          <p style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Nothing in tracey — including "tracey thinks" AI insights, safe-to-spend calculations, or any other feature — constitutes financial advice.</p>
          <p>All numbers, projections, and suggestions are estimates based on the data you enter. They are provided for informational purposes only. Always consult a qualified financial professional before making significant financial decisions.</p>
          <p>You are solely responsible for any financial decisions you make based on information shown in the app.</p>
        </Section>

        <Section title="Your account">
          <ul>
            <li>You must provide accurate information when creating an account</li>
            <li>You are responsible for maintaining the security of your password</li>
            <li>You must not share your account with others</li>
            <li>You must not use the app for any illegal purpose</li>
            <li>You must be at least 18 years old to use tracey</li>
          </ul>
        </Section>

        <Section title="Your data">
          <p>You own your data. You can delete your account and all associated data at any time from Settings → Delete all data. This action is permanent and irreversible.</p>
          <p>If you are using a tracey instance hosted by someone else, that server operator may have access to your data. Use only instances operated by people you trust.</p>
        </Section>

        <Section title="Acceptable use">
          <p>You agree not to:</p>
          <ul>
            <li>Attempt to access other users' data</li>
            <li>Reverse engineer, decompile, or attempt to extract the source code (beyond what is publicly licensed)</li>
            <li>Use the app in a way that could damage, disable, or impair the server it runs on</li>
            <li>Upload malicious files or attempt to exploit the PDF/CSV import features</li>
          </ul>
        </Section>

        <Section title="AI features">
          <p>tracey's AI features are powered by third-party models: Google Gemini (dashboard insights and PDF parsing), DeepSeek (product and rewards lookup), and Claude by Anthropic (AI chat). These outputs may be inaccurate, incomplete, or outdated. We do not guarantee the accuracy of any AI-generated content and are not liable for decisions made based on it.</p>
          <p>By using AI features, you acknowledge that relevant portions of your financial data are transmitted to these third-party services as described in our Privacy Policy.</p>
        </Section>

        <Section title="Disclaimer of warranties">
          <p>tracey is provided "as is" and "as available" without warranties of any kind, express or implied. We do not warrant that the app will be error-free, uninterrupted, or meet your specific requirements.</p>
          <p>We are not liable for any loss of data, financial loss, or other damages arising from your use of tracey.</p>
        </Section>

        <Section title="Limitation of liability">
          <p>To the maximum extent permitted by law, tracey and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of data or financial losses, arising from your use of or inability to use the service.</p>
        </Section>

        <Section title="Changes to terms">
          <p>We may update these terms from time to time. Continued use of the app after changes are posted constitutes acceptance of the updated terms.</p>
        </Section>

        <Section title="Contact">
          <p>Questions? Contact us at <a href="mailto:amir.ibrahim3000@gmail.com" style={{ color: 'var(--primary)' }}>amir.ibrahim3000@gmail.com</a>.</p>
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
