/** @type {import('tailwindcss').Config} */
// Nocturne design tokens (see src/index.css for the CSS-variable source of truth).
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        noct: {
          bg: "#161826",
          surface: "#232532",
          text: "#e9e9ed",
        },
        accent: {
          DEFAULT: "#9184d9",
          100: "#f5f4ff",
          200: "#e7e5fe",
          300: "#d2cefd",
          400: "#b5abfc",
          500: "#968ae0",
          600: "#796cbf",
          700: "#5d5294",
          800: "#423a6a",
          900: "#2b2741",
        },
        neutral: {
          100: "#f3f5fe",
          200: "#e4e7f5",
          300: "#cfd3e5",
          400: "#b2b6ca",
          500: "#9397ab",
          600: "#75798c",
          700: "#595d6c",
          800: "#3f424d",
          900: "#292b31",
        },
      },
      fontFamily: {
        display: ["Inter", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "noct-sm": "0 0 0 1px #3f424d",
        "noct-md": "0 0 0 1px #595d6c, 0 6px 18px rgba(0,0,0,0.55)",
        "noct-lg": "0 0 0 1px #9397ab, 0 16px 40px rgba(0,0,0,0.65)",
      },
    },
  },
  plugins: [],
};
