/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Void Palette (Forensic Minimalist)
        void: {
          DEFAULT: '#0A0A0B',    // Main app background
          dark: '#141416',        // Container backgrounds (Acts/Scenes)
          gray: '#2C2C2E',        // Grid lines, borders
        },
        surface: {
          high: '#1C1C1E',        // Panels, modals, node backgrounds
          low: '#141416',         // Lower elevation surfaces
        },
        accent: {
          indigo: '#6366F1',      // Primary actions, active state
          purple: '#A855F7',      // Spine (Dialogue) nodes
          cyan: '#06B6D4',        // Satellite (B-Roll) nodes
          amber: '#F59E0B',       // Multicam / Isolation mode
          red: '#EF4444',         // Paradox / Error / Recording
          green: '#10B981',       // Success / Active status
        },
        text: {
          primary: '#FFFFFF',     // Main text
          secondary: '#A0A0A3',   // Dimmed text
          tertiary: '#6B6B6F',    // Very dim text
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'timecode': ['13px', { lineHeight: '1.2', letterSpacing: '0.05em' }],
        'forensic': ['11px', { lineHeight: '1.2', letterSpacing: '0.08em' }],
      },
      spacing: {
        'panel-sm': '250px',
        'panel-md': '300px',
        'panel-lg': '400px',
      },
      borderRadius: {
        'node': '8px',
      },
      boxShadow: {
        'node': '0 4px 12px rgba(0, 0, 0, 0.5)',
        'node-active': '0 0 0 2px #6366F1, 0 8px 16px rgba(99, 102, 241, 0.3)',
        'ghost': '0 0 12px rgba(239, 68, 68, 0.5)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
