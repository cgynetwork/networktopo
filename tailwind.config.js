/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#FFFFFF',
        sidebar: '#FAFAFA',
        panel: '#FAFAFA',
        border: '#E5E5E5',
        'text-primary': '#1A1A1A',
        'text-secondary': '#6B7280',
        'select-bg': '#E3F2FD',
        'select-border': '#2196F3',
        'flow-blue': '#2196F3',
        'hover-bg': '#F3F4F6',
        danger: '#EF4444',
      },
      fontFamily: {
        sans: ['Microsoft YaHei', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['9px', { lineHeight: '1.25' }],
        'category': ['14px', { fontWeight: '600' }],
        'device-name': ['13px', { fontWeight: '500' }],
        'device-model': ['12px', { fontWeight: '400' }],
        'node-name': ['12px', { fontWeight: '500' }],
        'node-model': ['10px', { fontWeight: '400' }],
      },
      width: {
        sidebar: '260px',
        panel: '280px',
      },
      height: {
        toolbar: '48px',
      },
    },
  },
  plugins: [],
}