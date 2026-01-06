import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        apollo: {
          primary: '#6366f1', // indigo-500
          secondary: '#ec4899', // pink-500
          accent: '#fbbf24', // amber-400
          dark: '#1e1b4b', // indigo-950
          light: '#f0f9ff', // sky-50
        },
      },
      fontFamily: {
        sans: ['var(--font-pretendard)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
