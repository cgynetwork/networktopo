/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--color-canvas)',
        sidebar: 'var(--color-sidebar)',
        panel: 'var(--color-panel)',
        surface: 'var(--color-surface)',
        border: 'var(--color-border)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'select-bg': 'var(--color-select-bg)',
        'select-border': 'var(--color-select-border)',
        'flow-blue': 'var(--color-flow-blue)',
        'hover-bg': 'var(--color-hover-bg)',
        danger: 'var(--color-danger)',
        'danger-bg': 'var(--color-danger-bg)',
        'amber-bg': 'var(--color-amber-bg)',
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