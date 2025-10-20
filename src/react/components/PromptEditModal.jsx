import React, { useState, useEffect } from 'react';
import Button from './Button';

const PromptEditModal = ({ isOpen, onClose, onSave, currentPrompt, defaultPrompt }) => {
  const [prompt, setPrompt] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPrompt(currentPrompt || defaultPrompt || '');
    }
  }, [isOpen, currentPrompt, defaultPrompt]);

  const handleSave = () => {
    onSave(prompt);
    onClose();
  };

  const handleCancel = () => {
    setPrompt(currentPrompt || defaultPrompt || '');
    onClose();
  };

  const handleReset = () => {
    setPrompt(defaultPrompt);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm"
      onClick={handleCancel}
    >
      <div 
        className="bg-white w-full max-w-2xl max-h-[80vh] rounded-lg overflow-hidden flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Edit Transcription Prompt</h2>
          <button 
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Body */}
        <div className="flex-1 px-4 py-5 overflow-y-auto">
          <p className="text-sm text-gray-600 mb-4">
            Customize the prompt used to enhance your transcriptions.
          </p>
          
          <textarea
            className="w-full p-4 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent resize-none"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter your custom prompt..."
            rows={10}
          />
          
          <div className="text-right mt-2 text-xs text-gray-500">
            {prompt.length} characters
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={prompt === defaultPrompt}
          >
            Reset to Default
          </Button>
          
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={prompt.trim().length === 0}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromptEditModal;