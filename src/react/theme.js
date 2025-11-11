/**
 * Locus Design System Theme Configuration
 * Based on Locus theme analysis - comprehensive design tokens for Wave
 */

const theme = {
  // Color Palette
  colors: {
    // Primary & Accent Colors
    primary: {
      light: '#00b4d5',
      dark: '#00d4ff',
      DEFAULT: '#00b4d5',
    },
    accent: {
      light: '#00b4d5',
      dark: '#00d4ff',
      DEFAULT: '#00b4d5',
    },

    // Text Colors
    text: {
      primary: {
        light: '#040402',
        dark: '#FAFAFA',
        DEFAULT: '#040402',
      },
      body: {
        light: '#333333',
        dark: '#D0D0D0',
        DEFAULT: '#333333',
      },
      secondary: {
        light: '#666666',
        dark: '#A0A0A0',
        DEFAULT: '#666666',
      },
      tertiary: {
        light: '#999999',
        dark: '#707070',
        DEFAULT: '#999999',
      },
    },

    // Background Colors (3-tier hierarchy)
    background: {
      primary: {
        light: '#FBFBFB',
        dark: '#0a0a0a',
        DEFAULT: '#FBFBFB',
      },
      surface: {
        light: '#FFFFFF',
        dark: '#1a1a1a',
        DEFAULT: '#FFFFFF',
      },
      secondary: {
        light: '#F0F0F0',
        dark: '#252525',
        DEFAULT: '#F0F0F0',
      },
    },

    // Button Colors
    button: {
      bg: {
        light: '#040402',
        dark: '#FAFAFA',
        DEFAULT: '#040402',
      },
      text: {
        light: '#FFFFFF',
        dark: '#040402',
        DEFAULT: '#FFFFFF',
      },
      hover: {
        light: '#1a1a1a',
        dark: '#E0E0E0',
        DEFAULT: '#1a1a1a',
      },
    },

    // Border Colors
    border: {
      light: {
        light: '#EEEEEE',
        dark: '#2a2a2a',
        DEFAULT: '#EEEEEE',
      },
      medium: {
        light: '#DDDDDD',
        dark: '#3a3a3a',
        DEFAULT: '#DDDDDD',
      },
      dark: {
        light: '#CCCCCC',
        dark: '#4a4a4a',
        DEFAULT: '#CCCCCC',
      },
    },

    // Highlight Colors
    code: {
      light: '#ec5c5c',
      dark: '#ff6b6b',
      DEFAULT: '#ec5c5c',
    },
    mark: {
      light: '#ffe066',
      dark: '#ffd93d',
      DEFAULT: '#ffe066',
    },

    // Grid Pattern
    grid: {
      light: '#EEEEEE',
      dark: '#2a2a2a',
      DEFAULT: '#EEEEEE',
    },

    // Semantic Colors
    success: {
      light: '#4CAF50',
      dark: '#66BB6A',
      DEFAULT: '#4CAF50',
    },
    warning: {
      light: '#FF9800',
      dark: '#FFA726',
      DEFAULT: '#FF9800',
    },
    error: {
      light: '#F44336',
      dark: '#EF5350',
      DEFAULT: '#F44336',
    },
    info: {
      light: '#2196F3',
      dark: '#42A5F5',
      DEFAULT: '#2196F3',
    },
  },

  // Typography Scale (7 levels)
  fontSize: {
    xs: ['12px', { lineHeight: '16px', fontWeight: '400' }],     // Labels, captions
    sm: ['14px', { lineHeight: '20px', fontWeight: '400' }],     // Small text
    base: ['16px', { lineHeight: '24px', fontWeight: '400' }],   // Body, buttons, inputs
    lg: ['18px', { lineHeight: '28px', fontWeight: '400' }],     // Large text
    xl: ['20px', { lineHeight: '28px', fontWeight: '400' }],     // Extra large
    xxl: ['24px', { lineHeight: '32px', fontWeight: '700' }],    // Node titles
    xxxl: ['32px', { lineHeight: '40px', fontWeight: '700' }],   // Page titles
  },

  // Font Weights
  fontWeight: {
    regular: '400',
    medium: '500',
    bold: '700',
  },

  // Spacing Scale (4pt/8pt grid system)
  spacing: {
    xxs: '1px',    // 1pt
    xs: '2px',     // 2pt
    sm: '4px',     // 4pt
    md: '8px',     // 8pt
    lg: '12px',    // 12pt
    xl: '16px',    // 16pt
    xxl: '20px',   // 20pt
    xxxl: '24px',  // 24pt
    xxxxl: '32px', // 32pt
    xxxxxl: '48px', // 48pt
  },

  // Corner Radius
  borderRadius: {
    none: '0',
    sm: '4px',     // Small elements
    md: '8px',     // Inputs, cards (Standard)
    lg: '12px',    // Larger components
    xl: '16px',    // Hero cards
    full: '9999px', // Pills
  },

  // Shadows & Depth
  boxShadow: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    none: 'none',
  },

  // Animation & Transitions
  transitionDuration: {
    fast: '200ms',    // Hover effects, color transitions
    DEFAULT: '300ms', // Sidebar toggle, modals
    slow: '500ms',    // Splash fade
  },

  transitionTimingFunction: {
    DEFAULT: 'cubic-bezier(0.35, 0.01, 0.77, 0.34)',
    ease: 'ease',
    linear: 'linear',
    in: 'ease-in',
    out: 'ease-out',
    inOut: 'ease-in-out',
  },

  // Component-specific dimensions
  components: {
    sidebar: {
      expanded: '256px',
      collapsed: '48px',
    },
    grid: {
      size: '32px',
    },
    form: {
      maxWidth: '600px',
    },
    input: {
      maxWidth: '400px',
    },
    touch: {
      minTarget: '44px', // Apple HIG standard
    },
    otp: {
      size: '48px',
    },
  },

  // Responsive Breakpoints
  screens: {
    mobile: '600px',
    tablet: '1024px',
    desktop: '1440px',
  },
};

export default theme;
