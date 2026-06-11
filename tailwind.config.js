/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: '#7D5A7D',
          purpleLight: '#E6DCE6',
          ink: '#1F1F1F',
          cardBg: '#F5F4F6',
        }
      }
    }
  },
  plugins: [],
};
