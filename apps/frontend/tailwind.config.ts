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
          surface: 'rgba(255,255,255,0.04)',
          border: 'rgba(255,255,255,0.08)',
          primary: '#4F7CFF',
          accent: '#7C5CFF',
          success: '#22C55E',
          danger: '#EF4444',
        },
      },
      boxShadow: {
        soft: '0 18px 50px rgba(37, 99, 235, 0.16)',
        glass: '0 8px 32px rgba(0, 0, 0, 0.37)',
        glow: '0 0 20px rgba(79, 124, 255, 0.15)',
        'glow-accent': '0 0 20px rgba(124, 92, 255, 0.15)',
        card: '0 4px 24px rgba(0, 0, 0, 0.25)',
      },
      borderRadius: {
        card: '16px',
        'card-lg': '20px',
        button: '12px',
        pill: '9999px',
      },
      backdropBlur: {
        glass: '22px',
      },
    },
  },
  plugins: [],
} satisfies Config;
