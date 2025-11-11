import React from 'react';

const SplashScreen = () => {
  return (
    <div className="fixed inset-0 bg-white flex items-center justify-center">
      <div className="text-center">
        {/* Logo */}
        {/* <div className="w-24 h-24 mx-auto mb-4 bg-gray-50 rounded-2xl flex items-center justify-center animate-fade-in p-2 border border-gray-100">
          <img
            src="./assets/logo.png"
            alt="Wave Logo"
            className="w-16 h-16 object-contain"
          />
        </div> */}

        <h1 className="text-5xl font-light text-gray-900 mb-2 animate-fade-in-delay">
          Talk with your computer.
        </h1>

        <p className="text-gray-600 text-lg animate-fade-in-delay-2">
          AI powered voice to text.
        </p>

        <p className="text-gray-400 text-xs mt-6 animate-fade-in-delay-3">
          Made with ❤️ by <a href="https://siddg.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600">siddg.com</a>
        </p>
      </div>
      
      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
        
        .animate-fade-in-delay {
          animation: fade-in 0.6s ease-out 0.2s both;
        }
        
        .animate-fade-in-delay-2 {
          animation: fade-in 0.6s ease-out 0.4s both;
        }

        .animate-fade-in-delay-3 {
          animation: fade-in 0.6s ease-out 0.6s both;
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;