/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}', './node_modules/liquid-glass-react/dist/index.esm.js'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: 'color-mix(in srgb, var(--bg) calc(<alpha-value> * 100%), transparent)', bg2: 'color-mix(in srgb, var(--bg-2) calc(<alpha-value> * 100%), transparent)', panel: 'color-mix(in srgb, var(--panel) calc(<alpha-value> * 100%), transparent)', line: 'color-mix(in srgb, var(--panel-border) calc(<alpha-value> * 100%), transparent)',
        fg: 'color-mix(in srgb, var(--text) calc(<alpha-value> * 100%), transparent)', muted: 'color-mix(in srgb, var(--muted) calc(<alpha-value> * 100%), transparent)', accent: 'color-mix(in srgb, var(--accent) calc(<alpha-value> * 100%), transparent)', mint: 'color-mix(in srgb, var(--accent-2) calc(<alpha-value> * 100%), transparent)',
        amber: 'color-mix(in srgb, var(--accent-3) calc(<alpha-value> * 100%), transparent)', danger: 'color-mix(in srgb, var(--danger) calc(<alpha-value> * 100%), transparent)', sky: 'color-mix(in srgb, var(--sky) calc(<alpha-value> * 100%), transparent)',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      maxWidth: { page: '1240px' },
    },
  },
  plugins: [],
}
