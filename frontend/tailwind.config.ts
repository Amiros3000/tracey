import type { Config } from 'tailwindcss'

// Colors reference CSS variables so dark mode is handled automatically
// by the :root / @media(prefers-color-scheme:dark) declarations in globals.css.
// Use these in class names: bg-primary, text-secondary, etc.
const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary:          'var(--primary)',
        'primary-pressed':'var(--primary-pressed)',
        'primary-light':  'var(--primary-light-bg)',
        'primary-dark':   'var(--primary-dark)',
        bg:               'var(--bg)',
        surface:          'var(--surface)',
        card:             'var(--card)',
        'text-primary':   'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        success:          'var(--success)',
        warning:          'var(--warning)',
        danger:           'var(--danger)',
      },
      fontFamily: {
        // Nunito for all UI text — loaded from unpkg in globals.css
        sans: ['Nunito', 'system-ui', 'sans-serif'],
        // Mono only for amounts and dates — spec requirement
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'monospace'],
      },
      // Minimum 44px touch targets per spec
      minHeight: {
        touch: '44px',
      },
      minWidth: {
        touch: '44px',
      },
    },
  },
  plugins: [],
}

export default config
