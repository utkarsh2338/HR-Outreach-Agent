/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      colors: {
        accent: '#4f46e5',
      },
      spacing: {
        // Reinforce that we use the 8px grid (Tailwind's default 4px base × 2)
        // Standard Tailwind values already cover this: 2=8px, 4=16px, 6=24px, 8=32px
      },
    },
  },
  plugins: [],
};
