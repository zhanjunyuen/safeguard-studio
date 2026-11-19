/** @type {import('tailwindcss').Config} */
// Safeguard Studio tokens. Use these names, not raw Tailwind palette colours.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: { DEFAULT: '#F4F1EA', deep: '#EAE5D8', card: '#FFFDF8' },
        ink: { DEFAULT: '#16161A', 2: '#3F3F46', 3: '#5E5E66' },
        line: { DEFAULT: '#D6CFBF', strong: '#16161A' },
        signal: { DEFAULT: '#FFC629', soft: '#FFF0C2' },
        pass: { DEFAULT: '#1F7A3E', soft: '#E3F1E4' },
        fail: { DEFAULT: '#C2362B', soft: '#F9E3DF' },
        partial: { DEFAULT: '#9A5B00', soft: '#FBEBCB' },
        neutral: { DEFAULT: '#4B5563', soft: '#E7E7EA' },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['"Atkinson Hyperlegible"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: { sm: '4px', DEFAULT: '6px', md: '10px' },
      boxShadow: {
        hard: '3px 3px 0 0 #16161A',
        'hard-lg': '5px 5px 0 0 #16161A',
      },
      borderWidth: { 1.5: '1.5px' },
    },
  },
  plugins: [],
};
