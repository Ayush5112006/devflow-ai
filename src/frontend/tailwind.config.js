/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Shifted to steel-grey rather than pure midnight-navy.
        // Less "hacker dashboard", more "control-room workstation".
        navy: {
          950: '#0e1117',   // app body — dark charcoal, not pure black
          900: '#161b24',   // sidebar / navbar — steel-grey-blue
          850: '#1c2330',   // card alt background
          800: '#212b3a',   // card surface
          750: '#273244',   // card hover / table rows
          700: '#2e3d52',   // borders / dividers (stronger)
          600: '#3d5268',   // disabled / muted fills
          500: '#5470a0',   // accent muted
        },
        brand: {
          50:  '#eef4ff',
          100: '#d8e8ff',
          400: '#5b8dee',   // slightly desaturated — less neon
          500: '#3d6fd4',
          600: '#2457b8',   // primary action blue — IBM-era blue
          700: '#1a4293',
        },
        risk: {
          critical: '#cc2222',   // muted red — readable, not glowing
          high:     '#c85a00',
          medium:   '#b08000',
          low:      '#1a7a34',
        },
        surface: {
          DEFAULT: '#212b3a',
          hover:   '#273244',
          border:  '#2e3d52',   // visible solid border, not near-invisible
          muted:   '#253042',
        },
      },
      fontFamily: {
        // Keep system fonts but lean toward Segoe UI for Win/office feel
        sans: ['Segoe UI', '-apple-system', 'system-ui', 'sans-serif'],
        mono: ['Consolas', 'Courier New', 'monospace'],
      },
      borderRadius: {
        // Flatten all default radii one step — less bubbly, more office
        DEFAULT: '3px',
        sm:      '2px',
        md:      '3px',
        lg:      '4px',
        xl:      '6px',
        '2xl':   '8px',
        full:    '9999px',
      },
      boxShadow: {
        // Flat inset style — no glow, no blur lift
        card:       'inset 0 1px 0 rgba(255,255,255,0.04), 0 1px 2px rgba(0,0,0,0.3)',
        'card-hover':'inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 6px rgba(0,0,0,0.35)',
        btn:        'inset 0 1px 0 rgba(255,255,255,0.12), 0 1px 2px rgba(0,0,0,0.3)',
        'btn-press': 'inset 0 1px 2px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
}
