/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Unslop Graphite Ramp (Craft & Restraint)
        background: '#141415',
        surface: {
          deepest: '#0f0f10',
          DEFAULT: '#19191b',
          elevated: '#232325',
          hover: '#29292c',
          border: 'rgba(237, 237, 237, 0.08)'
        },
        hairline: 'rgba(237, 237, 237, 0.08)',
        hairlineLight: 'rgba(237, 237, 237, 0.12)',
        // World Accent: Studio Hardware Amber / Warm Copper
        accent: {
          DEFAULT: '#F59E0B',
          hover: '#D97706',
          muted: 'rgba(245, 158, 11, 0.15)',
          text: '#FBBF24'
        },
        // Backward-compatibility aliases mapped to neutral craft & accent
        primary: {
          DEFAULT: '#ededed',
          hover: '#ffffff',
          light: '#ededed',
          dark: '#0f0f10'
        },
        secondary: {
          DEFAULT: '#F59E0B',
          hover: '#D97706',
          light: '#FBBF24'
        },
        text: {
          DEFAULT: '#ededed',
          primary: '#ededed',
          secondary: '#a1a1a6',
          muted: '#85858b'
        },
        semantic: {
          success: '#4cc38a',
          error: '#e5484d',
          warning: '#f59e0b'
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace']
      },
      borderRadius: {
        'control': '8px',
        'card': '14px',
        'panel': '16px'
      },
      boxShadow: {
        'subtle': '0 1px 2px rgba(0, 0, 0, 0.24)',
        'highlight': 'inset 0 1px 0 rgba(255, 255, 255, 0.06)'
      }
    },
  },
  plugins: [],
}
