/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        // Status colors
        'status-red': '#EF4444',
        'status-red-light': '#FEE2E2',
        'status-orange': '#F97316',
        'status-orange-light': '#FFEDD5',
        'status-green': '#22C55E',
        'status-green-light': '#DCFCE7'
      }
    }
  },
  plugins: []
};
