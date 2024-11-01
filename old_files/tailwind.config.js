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
  plugins: [nextui({
    "themes": {
      "light": {
        "colors": {
          "default": {
            "50": "#fffdfc",
            "100": "#fffbf7",
            "200": "#fff8f3",
            "300": "#fff5ee",
            "400": "#fff3ea",
            "500": "#fff0e5",
            "600": "#d2c6bd",
            "700": "#a69c95",
            "800": "#79726d",
            "900": "#4d4845",
            "foreground": "#000",
            "DEFAULT": "#fff0e5"
          },
          "primary": {
            "50": "#fff2e5",
            "100": "#fee0c0",
            "200": "#fdce9b",
            "300": "#fcbb77",
            "400": "#fca952",
            "500": "#fb972d",
            "600": "#cf7d25",
            "700": "#a3621d",
            "800": "#774815",
            "900": "#4b2d0e",
            "foreground": "#000",
            "DEFAULT": "#fb972d"
          },
          "secondary": {
            "50": "#f0f4fe",
            "100": "#dbe4fd",
            "200": "#c6d5fb",
            "300": "#b1c5fa",
            "400": "#9cb6f8",
            "500": "#87a6f7",
            "600": "#6f89cc",
            "700": "#586ca1",
            "800": "#404f75",
            "900": "#29324a",
            "foreground": "#000",
            "DEFAULT": "#87a6f7"
          },
          "success": {
            "50": "#e2f8ec",
            "100": "#b9efd1",
            "200": "#91e5b5",
            "300": "#68dc9a",
            "400": "#40d27f",
            "500": "#17c964",
            "600": "#13a653",
            "700": "#0f8341",
            "800": "#0b5f30",
            "900": "#073c1e",
            "foreground": "#000",
            "DEFAULT": "#17c964"
          },
          "warning": {
            "50": "#fef4e4",
            "100": "#fce4bd",
            "200": "#fad497",
            "300": "#f9c571",
            "400": "#f7b54a",
            "500": "#f5a524",
            "600": "#ca881e",
            "700": "#9f6b17",
            "800": "#744e11",
            "900": "#4a320b",
            "foreground": "#000",
            "DEFAULT": "#f5a524"
          },
          "danger": {
            "50": "#fee1eb",
            "100": "#fbb8cf",
            "200": "#f98eb3",
            "300": "#f76598",
            "400": "#f53b7c",
            "500": "#f31260",
            "600": "#c80f4f",
            "700": "#9e0c3e",
            "800": "#73092e",
            "900": "#49051d",
            "foreground": "#000",
            "DEFAULT": "#f31260"
          },
          "background": "#fff6ef",
          "foreground": {
            "50": "#e4e2e0",
            "100": "#beb9b3",
            "200": "#978f87",
            "300": "#71665b",
            "400": "#4b3d2f",
            "500": "#251403",
            "600": "#1f1102",
            "700": "#180d02",
            "800": "#120a01",
            "900": "#0b0601",
            "foreground": "#fff",
            "DEFAULT": "#251403"
          },
          "content1": {
            "DEFAULT": "#ffffff",
            "foreground": "#000"
          },
          "content2": {
            "DEFAULT": "#f4f4f5",
            "foreground": "#000"
          },
          "content3": {
            "DEFAULT": "#e4e4e7",
            "foreground": "#000"
          },
          "content4": {
            "DEFAULT": "#d4d4d8",
            "foreground": "#000"
          },
          "focus": "#d342f2",
          "overlay": "#000000",
          "divider": "#111111"
        }
      },
      "dark": {
        "colors": {
          "default": {
            "50": "#e7e7e8",
            "100": "#c5c5c8",
            "200": "#a4a4a7",
            "300": "#828287",
            "400": "#616166",
            "500": "#3f3f46",
            "600": "#34343a",
            "700": "#29292e",
            "800": "#1e1e21",
            "900": "#131315",
            "foreground": "#fff",
            "DEFAULT": "#3f3f46"
          },
          "primary": {
            "50": "#fff2e5",
            "100": "#fee0c0",
            "200": "#fdce9b",
            "300": "#fcbb77",
            "400": "#fca952",
            "500": "#fb972d",
            "600": "#cf7d25",
            "700": "#a3621d",
            "800": "#774815",
            "900": "#4b2d0e",
            "foreground": "#000",
            "DEFAULT": "#fb972d"
          },
          "secondary": {
            "50": "#f0f4fe",
            "100": "#dbe4fd",
            "200": "#c6d5fb",
            "300": "#b1c5fa",
            "400": "#9cb6f8",
            "500": "#87a6f7",
            "600": "#6f89cc",
            "700": "#586ca1",
            "800": "#404f75",
            "900": "#29324a",
            "foreground": "#000",
            "DEFAULT": "#87a6f7"
          },
          "success": {
            "50": "#e2f8ec",
            "100": "#b9efd1",
            "200": "#91e5b5",
            "300": "#68dc9a",
            "400": "#40d27f",
            "500": "#17c964",
            "600": "#13a653",
            "700": "#0f8341",
            "800": "#0b5f30",
            "900": "#073c1e",
            "foreground": "#000",
            "DEFAULT": "#17c964"
          },
          "warning": {
            "50": "#fef4e4",
            "100": "#fce4bd",
            "200": "#fad497",
            "300": "#f9c571",
            "400": "#f7b54a",
            "500": "#f5a524",
            "600": "#ca881e",
            "700": "#9f6b17",
            "800": "#744e11",
            "900": "#4a320b",
            "foreground": "#000",
            "DEFAULT": "#f5a524"
          },
          "danger": {
            "50": "#fee1eb",
            "100": "#fbb8cf",
            "200": "#f98eb3",
            "300": "#f76598",
            "400": "#f53b7c",
            "500": "#f31260",
            "600": "#c80f4f",
            "700": "#9e0c3e",
            "800": "#73092e",
            "900": "#49051d",
            "foreground": "#000",
            "DEFAULT": "#f31260"
          },
          "background": "#251403",
          "foreground": {
            "50": "#fffdfc",
            "100": "#fffbf7",
            "200": "#fff8f3",
            "300": "#fff5ee",
            "400": "#fff3ea",
            "500": "#fff0e5",
            "600": "#d2c6bd",
            "700": "#a69c95",
            "800": "#79726d",
            "900": "#4d4845",
            "foreground": "#000",
            "DEFAULT": "#fff0e5"
          },
          "content1": {
            "DEFAULT": "#18181b",
            "foreground": "#fff"
          },
          "content2": {
            "DEFAULT": "#27272a",
            "foreground": "#fff"
          },
          "content3": {
            "DEFAULT": "#3f3f46",
            "foreground": "#fff"
          },
          "content4": {
            "DEFAULT": "#52525b",
            "foreground": "#fff"
          },
          "focus": "#d342f2",
          "overlay": "#ffffff",
          "divider": "#ffffff"
        }
      }
    },
    "layout": {
      "fontSize": {
        "tiny": "0.75rem",
        "small": "0.875rem",
        "medium": "1rem",
        "large": "1.125rem"
      },
      "lineHeight": {
        "tiny": "1rem",
        "small": "1.25rem",
        "medium": "1.5rem",
        "large": "1.75rem"
      },
      "radius": {
        "small": "0.5rem",
        "medium": "0.75rem",
        "large": "0.875rem"
      },
      "borderWidth": {
        "small": "1px",
        "medium": "2px",
        "large": "3px"
      },
      "disabledOpacity": "0.5",
      "dividerWeight": "1",
      "hoverOpacity": "0.9"
    }
  }
  )],
}

