/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        'inter': ['Inter', 'sans-serif'],
      },
      colors: {
        primary: '#D7FF1E',
        'primary-hover': '#C8F000',
        'primary-light': '#F0FF8A',
        'primary-foreground': '#1F2937',
        'text-primary': '#1F2937',
        'text-secondary': '#6B7280',
        'text-tertiary': '#9CA3AF',
        'text-hover': '#A3B300',
        'background': '#FFFFFF',
        'foreground': '#1F2937',
        'muted': '#F3F4F6',
        'muted-foreground': '#6B7280',
        'accent': '#F1F5F9',
        'accent-foreground': '#1F2937',
        'destructive': '#EF4444',
        'destructive-foreground': '#FFFFFF',
        'secondary': '#F8F9FB',
        'secondary-foreground': '#1F2937',
        'input': '#E5E7EB',
        'ring': '#D7FF1E',
        'border-light': '#E5E7EB',
        'border-subtle': '#F3F4F6',
        'border': '#E5E7EB',
        'surface': '#F8F9FB',
        'surface-elevated': '#FFFFFF',
        'surface-hover': '#F1F5F9',
      },
      borderRadius: {
        'default': '8px',
        'lg': '12px',
        'xl': '16px',
        'design': '28px',
      },
      boxShadow: {
        'design': '0 2px 4px rgba(16, 24, 40, 0.08)',
        'soft': '0 1px 3px rgba(0, 0, 0, 0.05)',
        'medium': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'large': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'premium': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        'glow': '0 0 0 1px rgba(215, 255, 30, 0.1), 0 4px 16px rgba(215, 255, 30, 0.15)',
      },
      maxWidth: {
        'content': '1280px',
      },
      spacing: {
        '60': '240px',
        '18': '72px',
        '72': '288px',
      },
      animation: {
        'dot-bounce': 'dot-bounce 1.2s infinite',
        'fade-slide-up': 'fade-slide-up 300ms ease-out',
        'fade-in': 'fade-in 500ms ease-out',
        'slide-up': 'slide-up 400ms ease-out',
        'scale-in': 'scale-in 200ms ease-out',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
      },
      keyframes: {
        'dot-bounce': {
          '0%, 80%, 100%': { transform: 'scale(0)' },
          '40%': { transform: 'scale(1)' },
        },
        'fade-slide-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 1px rgba(215, 255, 30, 0.1)' },
          '50%': { boxShadow: '0 0 0 1px rgba(215, 255, 30, 0.2), 0 0 20px rgba(215, 255, 30, 0.1)' },
        },
      },
      backdropBlur: {
        'xs': '2px',
      },
    },
  },
  plugins: [],
};