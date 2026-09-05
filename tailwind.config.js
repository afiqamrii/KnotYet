/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary brand - Kahoot/Duolingo energy purple
        brand: '#7C3AED',
        'brand-dark': '#5B21B6',
        'brand-light': '#A78BFA',
        // Game mode colors
        'game-swipe': '#FF2D9B',   // hot pink
        'game-quiz': '#06B6D4',    // teal
        'game-wheel': '#F59E0B',   // amber
        // Accent palette
        'accent-teal': '#0D9488',
        'accent-yellow': '#FACC15',
        'accent-orange': '#F97316',
        'accent-green': '#10B981',
        'accent-pink': '#EC4899',
        'accent-blue': '#3B82F6',
        // Card & surface
        'surface': '#FFFFFF',
        'surface-2': '#F5F3FF',
        'surface-3': '#EDE9FE',
        // Text
        'ink': '#1C1917',
        'ink-2': '#57534E',
        'ink-3': '#A8A29E',
        // Heart points
        'hearts': '#FF2D9B',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        'card': '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)',
        'card-lg': '0 16px 48px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.08)',
        'card-colored': '0 8px 24px rgba(124,58,237,0.25)',
        'btn': '0 4px 12px rgba(0,0,0,0.15)',
        'btn-pink': '0 6px 20px rgba(255,45,155,0.4)',
        'btn-teal': '0 6px 20px rgba(6,182,212,0.4)',
        'btn-amber': '0 6px 20px rgba(245,158,11,0.4)',
        'btn-green': '0 6px 20px rgba(16,185,129,0.4)',
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'float-slow': 'float 5s ease-in-out infinite',
        'pop-in': 'pop-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'slide-up': 'slide-up 0.3s ease-out',
        'wiggle': 'wiggle 0.4s ease-in-out',
        'bounce-once': 'bounce 0.5s ease-in-out 1',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
        'hearts-fly': 'hearts-fly 0.6s ease-out forwards',
        'shake': 'shake 0.4s ease-in-out',
        'scale-pulse': 'scale-pulse 1.5s ease-in-out infinite',
      },
      keyframes: {
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'pop-in': {
          '0%': { transform: 'scale(0.75) translateY(10px)', opacity: '0' },
          '100%': { transform: 'scale(1) translateY(0)', opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'wiggle': {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(-6deg)' },
          '75%': { transform: 'rotate(6deg)' },
        },
        'hearts-fly': {
          '0%': { transform: 'translateY(0) scale(1)', opacity: '1' },
          '100%': { transform: 'translateY(-60px) scale(0.5)', opacity: '0' },
        },
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-6px)' },
          '40%': { transform: 'translateX(6px)' },
          '60%': { transform: 'translateX(-4px)' },
          '80%': { transform: 'translateX(4px)' },
        },
        'scale-pulse': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.08)' },
        },
      },
    },
  },
  plugins: [],
}
