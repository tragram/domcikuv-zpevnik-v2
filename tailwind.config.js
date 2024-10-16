/** @type {import('tailwindcss').Config} */
import { nextui } from "@nextui-org/react"


export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        'selection': ['Selection'],
        'sono': ['Sono'],
      },
      screens: {
        'xs': '350px',
      },
    },
  },
  darkMode: "class",
  plugins: [nextui()],
}

