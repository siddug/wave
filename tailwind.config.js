const theme = require('./src/react/theme.js').default || require('./src/react/theme.js');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/react/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class', // Use class-based dark mode for manual control
  theme: {
    extend: {
      // Locus Color Palette
      colors: {
        // Primary colors
        primary: theme.colors.primary,
        accent: theme.colors.accent,

        // Backgrounds
        'bg-primary': theme.colors.background.primary,
        'bg-surface': theme.colors.background.surface,
        'bg-secondary': theme.colors.background.secondary,

        // Text colors
        'text-primary': theme.colors.text.primary,
        'text-body': theme.colors.text.body,
        'text-secondary': theme.colors.text.secondary,
        'text-tertiary': theme.colors.text.tertiary,

        // Button colors
        'btn-bg': theme.colors.button.bg,
        'btn-text': theme.colors.button.text,
        'btn-hover': theme.colors.button.hover,

        // Borders
        'border-light': theme.colors.border.light,
        'border-medium': theme.colors.border.medium,
        'border-dark': theme.colors.border.dark,

        // Highlights
        'code': theme.colors.code,
        'mark': theme.colors.mark,
        'grid': theme.colors.grid,

        // Semantic colors
        success: theme.colors.success,
        warning: theme.colors.warning,
        error: theme.colors.error,
        info: theme.colors.info,
      },

      // Locus Typography
      fontSize: theme.fontSize,
      fontWeight: theme.fontWeight,

      // Locus Spacing (4pt/8pt grid)
      spacing: theme.spacing,

      // Locus Corner Radius
      borderRadius: theme.borderRadius,

      // Locus Shadows
      boxShadow: theme.boxShadow,

      // Locus Animations
      transitionDuration: theme.transitionDuration,
      transitionTimingFunction: theme.transitionTimingFunction,

      // Responsive Breakpoints
      screens: theme.screens,

      // Component dimensions
      width: {
        'sidebar-expanded': theme.components.sidebar.expanded,
        'sidebar-collapsed': theme.components.sidebar.collapsed,
        'form-max': theme.components.form.maxWidth,
        'input-max': theme.components.input.maxWidth,
      },
      height: {
        'touch-min': theme.components.touch.minTarget,
        'otp': theme.components.otp.size,
      },
      minWidth: {
        'touch': theme.components.touch.minTarget,
      },
      minHeight: {
        'touch': theme.components.touch.minTarget,
      },
    },
  },
  plugins: [],
}