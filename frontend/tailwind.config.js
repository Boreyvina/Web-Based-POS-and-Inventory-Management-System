/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0B1F24',        // primary text / active nav
        canvas: '#F4F6F6',     // page background
        brand: {
          50: '#E8F4F3',
          100: '#C6E4E1',
          500: '#12867F',
          600: '#0E6C66',
          700: '#0A544F',
        },
        warn: { bg: '#FEF3C7', fg: '#92400E' },
        danger: { bg: '#FEE4E2', fg: '#B42318', 600: '#B42318' },
        ok: { bg: '#DCFCE7', fg: '#166534' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(11,31,36,0.06), 0 1px 3px rgba(11,31,36,0.04)',
      },
    },
  },
  plugins: [],
};
