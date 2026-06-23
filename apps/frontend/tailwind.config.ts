import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'SF Pro Display', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        premium: {
          bg: '#0B1220',
          card: '#111A2E',
          surface: 'rgba(255,255,255,0.04)',
          border: 'rgba(255,255,255,0.08)',
          primary: '#4C7DFF',
          accent: '#7C5CFF',
          success: '#22C55E',
          danger: '#EF4444',
          muted: '#7B8AA8',
        },
      },
      boxShadow: {
        soft: '0 18px 50px rgba(37, 99, 235, 0.16)',
        glass: '0 8px 32px rgba(0, 0, 0, 0.37)',
        glow: '0 0 20px rgba(76, 125, 255, 0.15)',
        'glow-accent': '0 0 20px rgba(124, 92, 255, 0.15)',
        card: '0 2px 12px rgba(0, 0, 0, 0.25)',
        'card-sm': '0 1px 6px rgba(0, 0, 0, 0.2)',
      },
      borderRadius: {
        card: '12px',
        'card-lg': '14px',
        button: '10px',
        pill: '9999px',
      },
      fontSize: {
        'h1': ['18px', '24px'],
        'h2': ['14px', '20px'],
        'body': ['12px', '16px'],
        'caption': ['10px', '14px'],
      },
      spacing: {
        'compact': '10px',
        'compact-lg': '14px',
      },
    },
  },
  plugins: [],
} satisfies Config;
