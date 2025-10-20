const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');

// Dynamically import node-llama-cpp with error handling
let { Llama, LlamaModel, LlamaContext, LlamaChatSession, getLlama } = {};
let llamaCppModule = null;
let llamaCppLoaded = false;

// Async function to load node-llama-cpp (ES module)
async function loadLlamaCpp() {
  try {
    console.log('[LLM] Loading node-llama-cpp (ES module)...');
    console.log('[LLM] Current working directory:', process.cwd());
    console.log('[LLM] __dirname:', __dirname);
    
    // Check if we're in production and log the module resolution paths
    if (app.isPackaged) {
      console.log('[LLM] Running in packaged app');
      console.log('[LLM] Resource path:', process.resourcesPath);
      console.log('[LLM] Exec path:', process.execPath);
      
      // Try to check if the module exists
      try {
        const modulePath = require.resolve('node-llama-cpp');
        console.log('[LLM] node-llama-cpp resolved to:', modulePath);
      } catch (e) {
        console.error('[LLM] Failed to resolve node-llama-cpp:', e.message);
      }
    }
    
    llamaCppModule = await import('node-llama-cpp');
    console.log('[LLM] node-llama-cpp loaded successfully');
    console.log('[LLM] Available exports:', Object.keys(llamaCppModule));
    console.log('[LLM] Available exports count:', Object.keys(llamaCppModule).length);
    ({ Llama, LlamaModel, LlamaContext, LlamaChatSession, getLlama } = llamaCppModule);
    console.log('[LLM] Required classes loaded successfully');
    console.log('[LLM] getLlama function available:', typeof getLlama);
    llamaCppLoaded = true;
    return true;
  } catch (error) {
    console.error('[LLM] Failed to load node-llama-cpp:', error.message);
    console.error('[LLM] Error type:', error.constructor.name);
    console.error('[LLM] Error code:', error.code);
    console.error('[LLM] Error stack:', error.stack);
    
    // Try to provide more specific error information
    if (error.code === 'MODULE_NOT_FOUND') {
      console.error('[LLM] Module not found - checking module paths...');
      console.error('[LLM] Module paths:', module.paths);
    }
    
    return false;
  }
}

class LLMService {
  constructor() {
    this.modelDir = path.join(app.getPath('userData'), 'models', 'llm');
    this.availableModels = {
      'llama-3.1-8b-instruct-q4': {
        id: 'llama-3.1-8b-instruct-q4',
        name: 'Meta Llama 3.1 8B Instruct (Q4_K_M)',
        url: 'https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf',
        size: 4.92 * 1024 * 1024 * 1024, // ~4.92GB
        filename: 'Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf',
        description: 'High-quality 8B parameter model, good balance of performance and speed',
        rating: 4.8,
        tags: ['instruction-following', 'chat', 'reasoning']
      },
      'gemma-3-1b-it-Q8_0': {
        id: 'gemma-3-1b-it-Q8_0',
        name: 'Google Gemma 3 1B Instruct (Q8_0)',
        url: 'https://huggingface.co/ggml-org/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q8_0.gguf',
        size: 1 * 1024 * 1024 * 1024, // ~2.73GB
        filename: 'gemma-3-1b-it-Q8_0.gguf',
        description: 'Compact yet capable model, excellent for fast inference',
        rating: 4.5,
        tags: ['fast', 'efficient', 'chat', 'instruction-following']
      },
      'gemma-3n-E4B-it-Q4_0.gguf': {
        id: 'gemma-3n-E4B-it-Q4_0.gguf',
        name: 'Google Gemma 3N E4B Instruct (Q4_0)',
        url: 'https://huggingface.co/unsloth/gemma-3n-E4B-it-GGUF/resolve/main/gemma-3n-E4B-it-Q4_0.gguf',
        size: 4 * 1024 * 1024 * 1024, // ~4.0 GiB
        filename: 'gemma-3n-E4B-it-Q4_0.gguf',
        description: 'E4B model from Google, excellent for fast inference with good quality.',
        rating: 4.5,
        tags: ['fast', 'efficient', 'chat', 'instruction-following']
      }
    };
    this.activeDownloads = new Map();
    this.llama = null;
    this.currentModel = null;
    this.currentContext = null;
    this.currentSession = null;
  }

  async init() {
    // Ensure LLM models directory exists
    try {
      await fs.mkdir(this.modelDir, { recursive: true });
      console.log('[LLM] Models directory created/verified:', this.modelDir);
    } catch (error) {
      console.error('Failed to create LLM models directory:', error);
    }

    // Load and initialize LlamaCpp if available
    try {
      if (!llamaCppLoaded) {
        console.log('[LLM] Loading node-llama-cpp...');
        console.log('[LLM] Running in production:', !require('electron').app.isPackaged ? 'NO' : 'YES');
        console.log('[LLM] Process type:', process.type);
        console.log('[LLM] Resource path:', process.resourcesPath);
        await loadLlamaCpp();
      }
      
      if (llamaCppLoaded) {
        console.log('[LLM] Initializing Llama instance...');
        this.llama = await getLlama();
        console.log('[LLM] Llama instance ready for use');
        console.log('[LLM] Llama instance type:', typeof this.llama);
      } else {
        console.warn('[LLM] LlamaCpp not available - inference will be disabled');
      }
    } catch (error) {
      console.warn('Failed to initialize LlamaCpp:', error.message);
      console.warn('Error details:', error);
      console.warn('Error stack:', error.stack);
    }
  }

  async downloadModel(modelId, progressCallback) {
    console.log(`[LLM] Download requested for ${modelId}`);
    
    // Check if already downloading (with more detailed logging)
    if (this.activeDownloads.has(modelId)) {
      const existingDownload = this.activeDownloads.get(modelId);
      console.log(`[LLM] Existing download found for ${modelId}:`, {
        cancelled: existingDownload?.cancelled,
        hasAbortController: !!existingDownload?.abortController,
        abortSignalAborted: existingDownload?.abortController?.signal?.aborted
      });
      
      if (existingDownload && !existingDownload.cancelled) {
        console.log(`[LLM] Download already active for ${modelId}, rejecting`);
        throw new Error(`Model ${modelId} is already being downloaded`);
      } else if (existingDownload && existingDownload.cancelled) {
        console.log(`[LLM] Previous download was cancelled, cleaning up for ${modelId}`);
        this.activeDownloads.delete(modelId);
      }
    }

    const model = this.availableModels[modelId];
    if (!model) {
      throw new Error(`Unknown model: ${modelId}`);
    }

    const modelPath = path.join(this.modelDir, model.filename);
    
    // Check if model already exists
    try {
      await fs.access(modelPath);
      console.log(`[LLM] Model ${modelId} already exists at ${modelPath}`);
      return { success: true, path: modelPath, message: 'Model already exists' };
    } catch {
      // Model doesn't exist, proceed with download
      console.log(`[LLM] Model ${modelId} does not exist, proceeding with download`);
    }

    // Create download tracking object - do this IMMEDIATELY to prevent race conditions
    const downloadInfo = {
      modelId,
      cancelled: false,
      abortController: new AbortController(),
      startTime: Date.now()
    };
    
    console.log(`[LLM] Setting download info for ${modelId}`);
    this.activeDownloads.set(modelId, downloadInfo);

    try {
      console.log(`[LLM] Starting download for ${modelId}: ${model.url}`);
      
      // Real download implementation (works regardless of LlamaCpp availability)
      const response = await fetch(model.url, {
        signal: downloadInfo.abortController.signal
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const totalSize = parseInt(response.headers.get('content-length') || model.size);
      let downloadedSize = 0;

      const fileHandle = await fs.open(modelPath, 'w');
      const stream = fileHandle.createWriteStream();

      const reader = response.body.getReader();
      
      try {
        while (true) {
          // Check if download was cancelled
          if (downloadInfo.cancelled || downloadInfo.abortController.signal.aborted) {
            throw new Error('Download cancelled');
          }
          
          const { done, value } = await reader.read();
          
          if (done) break;
          
          downloadedSize += value.length;
          stream.write(value);
          
          const progress = Math.round((downloadedSize / totalSize) * 100);
          if (progressCallback && !downloadInfo.cancelled) {
            progressCallback({ modelId, progress, downloadedSize, totalSize });
          }
        }
        
        await stream.end();
        await fileHandle.close();
        
        this.activeDownloads.delete(modelId);
        
        console.log(`[LLM] Download completed for ${modelId}`);
        
        return { 
          success: true, 
          path: modelPath, 
          message: `Successfully downloaded ${model.name}` 
        };
        
      } catch (error) {
        await stream.destroy();
        await fileHandle.close();
        
        // Clean up partial download
        try {
          await fs.unlink(modelPath);
        } catch {}
        
        throw error;
      }
      
    } catch (error) {
      this.activeDownloads.delete(modelId);
      
      if (error.name === 'AbortError' || error.message === 'Download cancelled') {
        console.log(`[LLM] Download cancelled for ${modelId}`);
        throw new Error(`Download cancelled for ${model.name}`);
      }
      
      console.error(`[LLM] Download failed for ${modelId}:`, error);
      throw new Error(`Failed to download ${model.name}: ${error.message}`);
    }
  }

  async getModelStatus(selectedModelId = null) {
    const status = {};
    
    for (const [modelId, model] of Object.entries(this.availableModels)) {
      const modelPath = path.join(this.modelDir, model.filename);
      
      try {
        await fs.access(modelPath);
        status[modelId] = {
          downloaded: true,
          path: modelPath,
          size: (await fs.stat(modelPath)).size,
          downloading: this.isDownloading(modelId),
          selected: selectedModelId === modelId
        };
      } catch {
        status[modelId] = {
          downloaded: false,
          path: null,
          size: 0,
          downloading: this.isDownloading(modelId),
          selected: false
        };
      }
    }
    
    return status;
  }

  async loadModel(modelId) {
    if (!llamaCppLoaded || !this.llama) {
      console.warn('[LLM] LlamaCpp not available - model loading disabled, but download/management still works');
      return { success: false, error: 'LlamaCpp not available', modelId };
    }

    const model = this.availableModels[modelId];
    if (!model) {
      console.error(`[LLM] Unknown model: ${modelId}`);
      return { success: false, error: `Unknown model: ${modelId}` };
    }

    const modelPath = path.join(this.modelDir, model.filename);
    
    try {
      await fs.access(modelPath);
      console.log(`[LLM] Model file exists at: ${modelPath}`);
    } catch {
      console.error(`[LLM] Model ${modelId} is not downloaded at path: ${modelPath}`);
      return { success: false, error: `Model ${modelId} is not downloaded` };
    }

    try {
      console.log(`[LLM] Starting model loading process for: ${modelId}`);
      console.log(`[LLM] Model path: ${modelPath}`);
      console.log(`[LLM] Llama instance available:`, !!this.llama);
      
      // Dispose of previous model and context if they exist
      if (this.currentSession) {
        console.log('[LLM] Disposing previous session');
        try {
          this.currentSession.dispose();
        } catch (e) {
          console.warn('[LLM] Error disposing session:', e);
        }
        this.currentSession = null;
      }
      if (this.currentContext) {
        console.log('[LLM] Disposing previous context');
        try {
          this.currentContext.dispose();
        } catch (e) {
          console.warn('[LLM] Error disposing context:', e);
        }
        this.currentContext = null;
      }
      if (this.currentModel) {
        console.log('[LLM] Disposing previous model');
        try {
          this.currentModel.dispose();
        } catch (e) {
          console.warn('[LLM] Error disposing model:', e);
        }
        this.currentModel = null;
      }

      // Load new model using the modern API
      console.log('[LLM] Loading model with Llama instance...');
      this.currentModel = await this.llama.loadModel({
        modelPath: modelPath
      });
      console.log('[LLM] Model loaded, currentModel is:', !!this.currentModel);

      console.log('[LLM] Creating context...');
      this.currentContext = await this.currentModel.createContext({
        contextSize: 4096
      });
      console.log('[LLM] Context created, currentContext is:', !!this.currentContext);

      console.log('[LLM] Creating chat session...');
      this.currentSession = new LlamaChatSession({
        contextSequence: this.currentContext.getSequence()
      });
      console.log('[LLM] Chat session created, currentSession is:', !!this.currentSession);

      // Verify all components are properly set
      const verificationStatus = {
        model: !!this.currentModel,
        context: !!this.currentContext,
        session: !!this.currentSession
      };
      console.log('[LLM] Verification status:', verificationStatus);

      if (!this.currentSession) {
        console.error('[LLM] Critical: Chat session is null after creation!');
        return { success: false, error: 'Failed to create chat session' };
      }

      console.log(`[LLM] Model ${modelId} loaded successfully with all components`);
      return { success: true, modelId };
    } catch (error) {
      console.error(`[LLM] Failed to load model ${modelId}:`, error);
      console.error('[LLM] Error stack:', error.stack);
      
      // Clean up on error
      this.currentSession = null;
      this.currentContext = null;
      this.currentModel = null;
      
      return { success: false, error: `Failed to load LLM model ${modelId}: ${error.message}` };
    }
  }

  async generateResponse(prompt, options = {}) {
    if (!llamaCppLoaded || !this.llama) {
      // For development/testing, return a mock response
      console.warn('[LLM] LlamaCpp not available, returning mock response');
      return {
        success: true,
        response: `Mock LLM response for prompt: "${prompt}". This is a test response that would normally be generated by the LLM model. The response demonstrates that the system is working correctly and would provide intelligent responses in a real deployment.`,
        model: 'mock-model'
      };
    }

    console.log(`[LLM] generateResponse called with prompt: "${prompt.substring(0, 50)}..."`);
    console.log(`[LLM] Current session state:`, !!this.currentSession);
    console.log(`[LLM] Current model state:`, !!this.currentModel);
    console.log(`[LLM] Current context state:`, !!this.currentContext);

    if (!this.currentSession) {
      console.error('[LLM] No current session available for inference');
      return { success: false, error: 'No LLM model loaded. Please select and load a model first.' };
    }

    try {
      console.log(`[LLM] Generating response for prompt: "${prompt.substring(0, 50)}..."`);
      
      const response = await this.currentSession.prompt(prompt, {
        temperature: options.temperature || 0.7,
        maxTokens: options.maxTokens || 512,
        topP: options.topP || 0.9,
        ...options
      });

      console.log(`[LLM] Generated response: "${response.substring(0, 100)}..."`);

      return {
        success: true,
        response: response,
        model: this.currentModel ? 'loaded-model' : 'unknown'
      };
    } catch (error) {
      console.error(`[LLM] Generation error:`, error);
      throw new Error(`LLM generation failed: ${error.message}`);
    }
  }

  async deleteModel(modelId) {
    const model = this.availableModels[modelId];
    if (!model) {
      throw new Error(`Unknown model: ${modelId}`);
    }

    if (this.activeDownloads.has(modelId)) {
      throw new Error(`Cannot delete model ${modelId}: download in progress`);
    }

    const modelPath = path.join(this.modelDir, model.filename);
    
    try {
      await fs.unlink(modelPath);
      
      // If this was the current model, clean up
      if (this.currentSession) {
        this.currentSession.dispose();
        this.currentSession = null;
      }
      if (this.currentContext) {
        this.currentContext.dispose();
        this.currentContext = null;
      }
      if (this.currentModel) {
        this.currentModel.dispose();
        this.currentModel = null;
      }
      
      return { success: true, message: `Deleted ${model.name}` };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { success: true, message: `Model ${model.name} was not found` };
      }
      throw new Error(`Failed to delete ${model.name}: ${error.message}`);
    }
  }

  isDownloading(modelId) {
    const downloadInfo = this.activeDownloads.get(modelId);
    return downloadInfo && !downloadInfo.cancelled;
  }

  cancelDownload(modelId) {
    const downloadInfo = this.activeDownloads.get(modelId);
    if (downloadInfo) {
      downloadInfo.cancelled = true;
      downloadInfo.abortController.abort();
      console.log(`[LLM] Cancelled download for ${modelId}`);
    }
  }

  getAvailableModels() {
    return Object.values(this.availableModels).map(model => ({
      id: model.id,
      name: model.name,
      size: model.size,
      description: model.description,
      rating: model.rating,
      tags: model.tags
    }));
  }

  dispose() {
    if (this.currentSession) {
      this.currentSession.dispose();
      this.currentSession = null;
    }
    if (this.currentContext) {
      this.currentContext.dispose();
      this.currentContext = null;
    }
    if (this.currentModel) {
      this.currentModel.dispose();
      this.currentModel = null;
    }
  }
}

module.exports = LLMService;