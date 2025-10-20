import React from 'react';

const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  state = 'default', 
  disabled = false,
  loading = false,
  onClick, 
  className = '',
  ...props 
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-full transition-all duration-200 focus:outline-none';
  
  const variants = {
    primary: 'bg-black text-white hover:bg-gray-800',
    secondary: 'bg-white text-gray-900 hover:bg-gray-50 border border-gray-300',
    success: 'bg-black text-white hover:bg-gray-800',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'bg-transparent text-gray-700 hover:bg-gray-100',
  };
  
  const sizes = {
    sm: 'px-5 py-0.5 text-sm',
    md: 'px-5 py-0.5 text-sm',
    lg: 'px-5 py-0.5 text-sm',
    xl: 'px-5 py-0.5 text-sm',
  };

  const states = {
    default: '',
    success: 'bg-green-600 text-white cursor-default',
    fail: 'bg-red-600 text-white hover:bg-red-700 cursor-pointer',
    disabled: 'bg-gray-300 text-gray-500 cursor-not-allowed',
  };

  const getVariantClasses = () => {
    if (state === 'success') return states.success;
    if (state === 'fail') return states.fail;
    if (state === 'disabled' || disabled) return states.disabled;
    return variants[variant];
  };

  const isClickable = state !== 'success' && state !== 'disabled' && !disabled && !loading;

  const getContent = () => {
    if (loading) {
      return (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading...
        </>
      );
    }

    if (state === 'success') {
      return (
        <>
          <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {children}
        </>
      );
    }

    if (state === 'fail') {
      return (
        <>
          <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.502 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          Retry
        </>
      );
    }

    return children;
  };

  return (
    <button
      className={`${baseClasses} ${sizes[size]} ${getVariantClasses()} ${className}`}
      onClick={isClickable ? onClick : undefined}
      disabled={!isClickable}
      {...props}
    >
      {getContent()}
    </button>
  );
};

export default Button;