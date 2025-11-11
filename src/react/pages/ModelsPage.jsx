import React, { useState, useEffect } from 'react';
import ModelCard from '../components/ModelCard';
import toast from 'react-hot-toast';

const ModelsPage = () => {
  const [activeTab, setActiveTab] = useState('whisper');
  const [models, setModels] = useState([
    { 
      id: 'tiny', 
      name: 'Whisper Tiny',
      language: 'Multilingual',
      size: '0.1 GiB',
      speed: 9.0,
      accuracy: 6.0,
      description: 'Tiny model: fastest, lowest accuracy. Good for quick tests or low-resource devices.',
      downloaded: false,
      downloading: false,
      progress: 0,
      selected: false
    },
    { 
      id: 'base', 
      name: 'Whisper Base',
      language: 'Multilingual', 
      size: '0.1 GiB',
      speed: 8.0,
      accuracy: 7.0,
      description: 'Base model: balance of speed and accuracy for general use.',
      downloaded: false,
      downloading: false,
      progress: 0,
      selected: false,
      recommended: false
    },
    { 
      id: 'small', 
      name: 'Whisper Small',
      language: 'Multilingual',
      size: '0.5 GiB',
      speed: 7.0,
      accuracy: 8.0,
      description: 'Small model: slower, but more accurate than base.',
      downloaded: true,
      downloading: false,
      progress: 100,
      selected: false,
      recommended: true
    },
    { 
      id: 'medium', 
      name: 'Whisper Medium',
      language: 'Multilingual',
      size: '1.5 GiB',
      speed: 6.5,
      accuracy: 9.0,
      description: 'Medium model: high accuracy, slower speed. Good for high-quality transcriptions.',
      downloaded: false,
      downloading: false,
      progress: 0,
      selected: false,
      recommended: false
    },
    { 
      id: 'large-v3-turbo', 
      name: 'Whisper Large V3 Turbo',
      language: 'Multilingual',
      size: '2.8 GiB',
      speed: 6,
      accuracy: 9.7,
      description: 'Large model v3 Turbo, faster than v3 with similar accuracy.',
      downloaded: true,
      downloading: false,
      progress: 100,
      selected: true
    },
  ]);

  const [llmModels, setLLMModels] = useState([
    {
      id: 'llama-3.1-8b-instruct-q4',
      name: 'Meta Llama 3.1 8B Instruct (Q4_K_M)',
      language: 'English',
      size: '4.9 GiB',
      speed: 7.5,
      accuracy: 9.2,
      description: 'High-quality 8B parameter model, excellent balance of performance and speed for various tasks.',
      downloaded: false,
      downloading: false,
      progress: 0,
      selected: false,
      recommended: false,
      tags: ['instruction-following', 'chat', 'reasoning']
    },
    {
      id: 'gemma-3-1b-it-Q8_0',
      name: 'Google Gemma 3 1B Instruct (Q8_0)',
      language: 'English', 
      size: '1.0 GiB',
      speed: 8,
      accuracy: 9.0,
      description: 'Compact yet capable model from Google, excellent for fast inference with good quality.',
      downloaded: false,
      downloading: false,
      progress: 0,
      selected: false,
      recommended: true,
      tags: ['fast', 'efficient', 'chat', 'instruction-following']
    },
    {
      id: 'gemma-3n-E4B-it-Q4_0.gguf',
      name: 'Google Gemma 3N E4B Instruct (Q4_0)',
      language: 'English',
      size: '4.0 GiB',
      speed: 9.5,
      accuracy: 8.0,
      description: 'E4B model from Google, excellent for fast inference with good quality.',
      downloaded: false,
      downloading: false,
      progress: 0,
      selected: false,
      recommended: false,
      tags: ['fast', 'efficient', 'chat', 'instruction-following']
    }
  ]);
  
  const [selectedModel, setSelectedModel] = useState('large-v3-turbo');
  const [selectedLLMModel, setSelectedLLMModel] = useState('');
  const [isTestingInference, setIsTestingInference] = useState(false);

  // Load initial data on mount only
  useEffect(() => {
    loadModelStatus();
    loadSelectedModel();
    loadLLMModelStatus();
    loadSelectedLLMModel();
  }, []); // Empty dependency array - only run once on mount

  // Set up event listeners separately to avoid recreation
  useEffect(() => {
    // Listen for model events
    const unsubscribeProgress = window.electronAPI?.models?.onDownloadProgress((data) => {
      setModels(prevModels =>
        prevModels.map(model =>
          model.id === data.modelId
            ? { ...model, progress: data.progress }
            : model
        )
      );
    });

    const unsubscribeComplete = window.electronAPI?.models?.onDownloadComplete((data) => {
      console.log(`[UI] Download complete event received:`, data);
      console.log(`[UI] data.autoSelected value:`, data.autoSelected, typeof data.autoSelected);
      
      setModels(prevModels => 
        prevModels.map(model => 
          model.id === data.modelId
            ? { 
                ...model, 
                downloading: false, 
                downloaded: data.success, 
                progress: 100,
                selected: data.autoSelected === true
              }
            : (data.autoSelected === true ? { ...model, selected: false } : model)
        )
      );
      
      if (data.success) {
        // Reload model status after download to sync with backend
        loadModelStatus();
        
        if (data.autoSelected === true) {
          console.log(`[UI] Auto-selecting model: ${data.modelId}`);
          setSelectedModel(data.modelId);
          toast.success(`${data.modelId} model downloaded and selected automatically!`);
        } else {
          console.log(`[UI] Model downloaded but not auto-selected: ${data.modelId}`);
          toast.success(`${data.modelId} model downloaded successfully!`);
        }
      } else {
        toast.error('Failed to download model');
      }
    });

    // LLM Model event listeners
    const unsubscribeLLMProgress = window.electronAPI?.llm?.onDownloadProgress((data) => {
      setLLMModels(prevModels => 
        prevModels.map(model => 
          model.id === data.modelId 
            ? { ...model, progress: data.progress }
            : model
        )
      );
    });

    const unsubscribeLLMComplete = window.electronAPI?.llm?.onDownloadComplete((data) => {
      console.log(`[UI] LLM Download complete event received:`, data);
      
      setLLMModels(prevModels => 
        prevModels.map(model => 
          model.id === data.modelId
            ? { 
                ...model, 
                downloading: false, 
                downloaded: data.success, 
                progress: 100,
                selected: data.autoSelected === true
              }
            : (data.autoSelected === true ? { ...model, selected: false } : model)
        )
      );
      
      if (data.success) {
        loadLLMModelStatus();
        
        if (data.autoSelected === true) {
          console.log(`[UI] Auto-selecting LLM model: ${data.modelId}`);
          setSelectedLLMModel(data.modelId);
          toast.success(`${data.modelId} LLM model downloaded and selected automatically!`);
        } else {
          console.log(`[UI] LLM Model downloaded but not auto-selected: ${data.modelId}`);
          toast.success(`${data.modelId} LLM model downloaded successfully!`);
        }
      } else {
        toast.error('Failed to download LLM model');
      }
    });

    return () => {
      if (unsubscribeProgress) unsubscribeProgress();
      if (unsubscribeComplete) unsubscribeComplete();
      if (unsubscribeLLMProgress) unsubscribeLLMProgress();
      if (unsubscribeLLMComplete) unsubscribeLLMComplete();
    };
  }, []); // Empty dependency array - listeners don't need to change

  const loadModelStatus = async () => {
    try {
      console.log('[UI] Loading model status...');
      const result = await window.electronAPI?.models?.getStatus();
      console.log('[UI] Model status result:', result);
      
      if (result) {
        setModels(prevModels => 
          prevModels.map(model => ({
            ...model,
            downloaded: result[model.id]?.downloaded ?? false,
            selected: result[model.id]?.selected ?? false,
            downloading: result[model.id]?.downloading ?? false
          }))
        );
        console.log('[UI] Models updated after status load');
      }
    } catch (error) {
      console.error('Failed to load model status:', error);
    }
  };

  const loadSelectedModel = async () => {
    try {
      const result = await window.electronAPI?.store?.get('selectedModel');
      if (result) {
        setSelectedModel(result);
      }
    } catch (error) {
      console.error('Failed to load selected model:', error);
    }
  };

  const loadLLMModelStatus = async () => {
    try {
      console.log('[UI] Loading LLM model status...');
      const result = await window.electronAPI?.llm?.getStatus();
      console.log('[UI] LLM Model status result:', result);
      
      if (result?.success && result.status) {
        setLLMModels(prevModels => 
          prevModels.map(model => ({
            ...model,
            downloaded: result.status[model.id]?.downloaded ?? false,
            selected: result.status[model.id]?.selected ?? false,
            downloading: result.status[model.id]?.downloading ?? false
          }))
        );
        
        // Find selected LLM model from status
        const selectedModelId = Object.keys(result.status).find(id => result.status[id]?.selected);
        if (selectedModelId) {
          setSelectedLLMModel(selectedModelId);
          console.log(`[UI] Found selected LLM model: ${selectedModelId}`);
        } else {
          console.log(`[UI] No LLM model selected`);
        }
        
        console.log('[UI] LLM Models updated after status load');
      }
    } catch (error) {
      console.error('Failed to load LLM model status:', error);
    }
  };

  const loadSelectedLLMModel = async () => {
    // This is now handled in loadLLMModelStatus to avoid duplicate calls
    console.log('[UI] loadSelectedLLMModel called - now handled by loadLLMModelStatus');
  };

  const handleDownloadModel = async (modelId) => {
    try {
      setModels(prevModels => 
        prevModels.map(model => 
          model.id === modelId 
            ? { ...model, downloading: true, progress: 0 }
            : model
        )
      );
      
      const result = await window.electronAPI?.models?.download(modelId);
      if (!result?.success) {
        toast.error('Failed to start model download');
        setModels(prevModels => 
          prevModels.map(model => 
            model.id === modelId 
              ? { ...model, downloading: false }
              : model
          )
        );
      }
    } catch (error) {
      toast.error('Failed to download model');
      setModels(prevModels => 
        prevModels.map(model => 
          model.id === modelId 
            ? { ...model, downloading: false }
            : model
        )
      );
    }
  };

  const handleSelectModel = async (modelId) => {
    try {
      const result = await window.electronAPI?.models?.select(modelId);
      if (result?.success) {
        setSelectedModel(modelId);
        setModels(prevModels => 
          prevModels.map(model => ({
            ...model,
            selected: model.id === modelId
          }))
        );
        toast.success(`${modelId} model selected`);
      } else {
        toast.error(result?.error || 'Failed to select model');
      }
    } catch (error) {
      toast.error('Failed to select model');
    }
  };

  const handleDeleteModel = async (modelId) => {
    console.log(`[UI] Attempting to delete model: ${modelId}`);
    try {
      const result = await window.electronAPI?.models?.delete(modelId);
      console.log(`[UI] Delete result:`, result);
      if (result?.success) {
        console.log(`[UI] Delete successful, reloading model status...`);
        // Reload models to reflect changes
        await loadModelStatus();
        toast.success(`${modelId} model deleted`);
        console.log(`[UI] Model status reloaded`);
      } else {
        console.log(`[UI] Delete failed:`, result?.error);
        toast.error(result?.error || 'Failed to delete model');
      }
    } catch (error) {
      console.log(`[UI] Delete error:`, error);
      toast.error('Failed to delete model');
    }
  };

  // LLM Model handlers
  const handleDownloadLLMModel = async (modelId) => {
    try {
      setLLMModels(prevModels => 
        prevModels.map(model => 
          model.id === modelId 
            ? { ...model, downloading: true, progress: 0 }
            : model
        )
      );
      
      const result = await window.electronAPI?.llm?.download(modelId);
      if (!result?.success) {
        toast.error('Failed to start LLM model download');
        setLLMModels(prevModels => 
          prevModels.map(model => 
            model.id === modelId 
              ? { ...model, downloading: false }
              : model
          )
        );
      }
    } catch (error) {
      toast.error('Failed to download LLM model');
      setLLMModels(prevModels => 
        prevModels.map(model => 
          model.id === modelId 
            ? { ...model, downloading: false }
            : model
        )
      );
    }
  };

  const handleSelectLLMModel = async (modelId) => {
    try {
      const result = await window.electronAPI?.llm?.select(modelId);
      if (result?.success) {
        setSelectedLLMModel(modelId);
        setLLMModels(prevModels => 
          prevModels.map(model => ({
            ...model,
            selected: model.id === modelId
          }))
        );
        toast.success(`${modelId} LLM model selected`);
      } else {
        toast.error(result?.error || 'Failed to select LLM model');
      }
    } catch (error) {
      toast.error('Failed to select LLM model');
    }
  };

  const handleDeleteLLMModel = async (modelId) => {
    console.log(`[UI] Attempting to delete LLM model: ${modelId}`);
    try {
      const result = await window.electronAPI?.llm?.delete(modelId);
      console.log(`[UI] LLM Delete result:`, result);
      if (result?.success) {
        console.log(`[UI] LLM Delete successful, reloading model status...`);
        await loadLLMModelStatus();
        toast.success(`${modelId} LLM model deleted`);
        console.log(`[UI] LLM Model status reloaded`);
      } else {
        console.log(`[UI] LLM Delete failed:`, result?.error);
        toast.error(result?.error || 'Failed to delete LLM model');
      }
    } catch (error) {
      console.log(`[UI] LLM Delete error:`, error);
      toast.error('Failed to delete LLM model');
    }
  };

  const handleTestInference = async () => {
    if (!selectedLLMModel) {
      toast.error('Please select an LLM model first');
      return;
    }

    setIsTestingInference(true);
    try {
      console.log(`[UI] Testing inference with model: ${selectedLLMModel}`);
      
      // Show loading toast
      const loadingToast = toast.loading('Loading model and running inference...');
      
      const result = await window.electronAPI?.llm?.testInference();
      
      // Dismiss loading toast
      toast.dismiss(loadingToast);
      
      if (result?.success) {
        toast.success('LLM inference test successful!');
        console.log(`[UI] Inference test result:`, result);
        
        // Show the response in a more detailed toast or alert
        const responsePreview = result.response?.substring(0, 150) + (result.response?.length > 150 ? '...' : '');
        toast.success(`Response: "${responsePreview}"`, {
          duration: 7000,
        });
        
        // Also log the full response to console for debugging
        console.log(`[UI] Full LLM response:`, result.response);
      } else {
        console.error(`[UI] Inference test failed:`, result?.error);
        toast.error(result?.error || 'LLM inference test failed');
      }
    } catch (error) {
      console.error(`[UI] Error testing inference:`, error);
      toast.error('Failed to test LLM inference');
    } finally {
      setIsTestingInference(false);
    }
  };

  const currentModels = activeTab === 'whisper' ? models : llmModels;
  const currentHandlers = activeTab === 'whisper' 
    ? { onDownload: handleDownloadModel, onSelect: handleSelectModel, onDelete: handleDeleteModel }
    : { onDownload: handleDownloadLLMModel, onSelect: handleSelectLLMModel, onDelete: handleDeleteLLMModel };

  return (
    <div className="space-y-xxxl p-xxxl bg-bg-primary-light dark:bg-bg-primary-dark min-h-screen transition-colors duration-fast">
      {/* Header */}
      <div>
        <h1 className="text-xxl font-bold text-text-primary-light dark:text-text-primary-dark mb-md transition-colors duration-fast">
          Manage Models
        </h1>
        <p className="text-base text-text-body-light dark:text-text-body-dark transition-colors duration-fast">
          {activeTab === 'whisper'
            ? 'Download, select, or delete Whisper models for transcription.'
            : 'Download, select, or delete language models for text generation.'}
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-border-light-light dark:border-border-light-dark transition-colors duration-fast">
        <nav className="-mb-px flex gap-xxxxl">
          <button
            onClick={() => setActiveTab('whisper')}
            className={`py-md px-xxs border-b-2 font-medium text-sm transition-all duration-fast ${
              activeTab === 'whisper'
                ? 'border-primary-light dark:border-primary-dark text-primary-light dark:text-primary-dark'
                : 'border-transparent text-text-secondary-light dark:text-text-secondary-dark hover:text-text-body-light dark:hover:text-text-body-dark hover:border-border-medium-light dark:hover:border-border-medium-dark'
            }`}
          >
            Speech to Text Models
          </button>
          <button
            onClick={() => setActiveTab('llm')}
            className={`py-md px-xxs border-b-2 font-medium text-sm transition-all duration-fast ${
              activeTab === 'llm'
                ? 'border-primary-light dark:border-primary-dark text-primary-light dark:text-primary-dark'
                : 'border-transparent text-text-secondary-light dark:text-text-secondary-dark hover:text-text-body-light dark:hover:text-text-body-dark hover:border-border-medium-light dark:hover:border-border-medium-dark'
            }`}
          >
            Language Models
          </button>
        </nav>
      </div>

      {/* Test Inference Button (only for LLM tab) */}
      {activeTab === 'llm' && selectedLLMModel && (
        <div className="bg-bg-secondary-light dark:bg-bg-secondary-dark rounded-lg p-xl border border-border-light-light dark:border-border-light-dark transition-colors duration-fast">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark transition-colors duration-fast">
                Test Inference
              </h3>
              <p className="text-sm text-text-body-light dark:text-text-body-dark transition-colors duration-fast">
                Test the selected LLM model ({selectedLLMModel}) with a sample prompt
              </p>
            </div>
            <button
              onClick={handleTestInference}
              disabled={isTestingInference}
              className={`px-xl py-md text-sm font-medium rounded-md border min-w-touch min-h-touch flex items-center justify-center transition-all duration-fast ${
                isTestingInference
                  ? 'bg-bg-secondary-light dark:bg-bg-secondary-dark text-text-tertiary-light dark:text-text-tertiary-dark border-border-light-light dark:border-border-light-dark cursor-not-allowed'
                  : 'bg-bg-surface-light dark:bg-bg-surface-dark text-text-body-light dark:text-text-body-dark border-border-medium-light dark:border-border-medium-dark hover:bg-bg-secondary-light dark:hover:bg-bg-secondary-dark hover:border-border-dark-light dark:hover:border-border-dark-dark'
              }`}
            >
              {isTestingInference ? (
                <div className="flex items-center gap-md">
                  <svg className="animate-spin h-4 w-4 text-text-tertiary-light dark:text-text-tertiary-dark" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Testing...
                </div>
              ) : (
                'Test Inference'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Models List */}
      <div className="space-y-lg">
        {currentModels.map((model) => (
          <ModelCard
            key={model.id}
            model={model}
            isSelected={model.selected}
            isDownloading={model.downloading}
            progress={model.progress}
            onDownload={currentHandlers.onDownload}
            onSelect={currentHandlers.onSelect}
            onDelete={currentHandlers.onDelete}
          />
        ))}
      </div>
    </div>
  );
};

export default ModelsPage;