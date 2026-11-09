const v = (name) => `var(--${name})`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // One weight per family: React Native picks a custom font by its family name, not by font-weight.
      fontFamily: { heading: ["Literata_600SemiBold"] },
      // Same token names as frontend/tailwind.config.ts, so a class means the same thing on both apps.
      colors: {
        bg: v("bg"),
        panel: v("panel"),
        text: v("text"),
        muted: v("muted"),
        border: v("border"),
        bubble: v("bubble"),
        surface: v("surface"),
        accent: v("accent"),
        "on-accent": v("on-accent"),
        dialogue: v("dialogue"),
        "warn-bg": v("warn-bg"),
        "warn-bar": v("warn-bar"),
        caution: v("caution"),
      },
    },
  },
};
