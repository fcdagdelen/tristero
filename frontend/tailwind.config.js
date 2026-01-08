/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'kg-primary': '#3B82F6',
        'kg-secondary': '#10B981',
        'kg-accent': '#F59E0B',
        'kg-dark': '#1F2937',
        'kg-light': '#F3F4F6',
      },
      animation: {
        'shimmer': 'shimmer 2s infinite linear',
        'pulse-ring': 'pulse-ring 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-up': 'slide-up 0.3s ease-out',
        'count-up': 'count-up 0.5s ease-out',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.8)', opacity: '0.8' },
          '50%': { transform: 'scale(1.2)', opacity: '0' },
          '100%': { transform: 'scale(0.8)', opacity: '0' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'count-up': {
          '0%': { transform: 'scale(1.2)', color: '#60A5FA' },
          '100%': { transform: 'scale(1)', color: 'inherit' },
        },
      },
    },
  },
  plugins: [],
}
