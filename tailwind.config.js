/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          400: 'rgb(var(--tw-primary-400-rgb) / <alpha-value>)',
          500: 'rgb(var(--tw-primary-500-rgb) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--tw-accent-rgb) / <alpha-value>)',
          light: 'rgb(var(--tw-accent-light-rgb) / <alpha-value>)',
          dark: 'rgb(var(--tw-accent-dark-rgb) / <alpha-value>)',
        },
        surface: {
          900: 'rgb(var(--tw-surface-900-rgb) / <alpha-value>)',
          800: 'rgb(var(--tw-surface-800-rgb) / <alpha-value>)',
          700: 'rgb(var(--tw-surface-700-rgb) / <alpha-value>)',
          600: 'rgb(var(--tw-surface-600-rgb) / <alpha-value>)',
        },
        neon: {
          cyan: 'rgb(var(--tw-neon-cyan-rgb) / <alpha-value>)',
          pink: 'rgb(var(--tw-neon-pink-rgb) / <alpha-value>)',
          green: 'rgb(var(--tw-neon-green-rgb) / <alpha-value>)',
        },
        text: {
          primary: 'rgb(var(--tw-text-primary-rgb) / <alpha-value>)',
          secondary: 'rgb(var(--tw-text-secondary-rgb) / <alpha-value>)',
          muted: 'rgb(var(--tw-text-muted-rgb) / <alpha-value>)',
        },
        success: 'rgb(var(--tw-success-rgb) / <alpha-value>)',
        danger: 'rgb(var(--tw-danger-rgb) / <alpha-value>)',
        warning: 'rgb(var(--tw-warning-rgb) / <alpha-value>)',
      },
      fontFamily: {
        gaming: ['Orbitron', 'Rajdhani', 'sans-serif'],
        display: ['Rajdhani', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'slide-up': 'slide-up 0.3s ease-out',
        'fade-in': 'fade-in 0.5s ease-out',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(245, 158, 11, 0.5)' },
          '50%': { boxShadow: '0 0 20px rgba(245, 158, 11, 0.8)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
