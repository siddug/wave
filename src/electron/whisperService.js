const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');

// Dynamically import whisper-node with error handling
let whisper = null;
try {
  whisper = require('whisper-node');
} catch (error) {
  console.warn('whisper-node not available:', error.message);
}

class WhisperService {
  constructor() {
    this.modelDir = path.join(app.getPath('userData'), 'models');
    this.availableModels = {
      'tiny': {
        id: 'tiny',
        name: 'Whisper Tiny',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
        size: 39 * 1024 * 1024, // ~39MB
        filename: 'ggml-tiny.bin'
      },
      'base': {
        id: 'base',
        name: 'Whisper Base',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
        size: 142 * 1024 * 1024, // ~142MB
        filename: 'ggml-base.bin'
      },
      'small': {
        id: 'small',
        name: 'Whisper Small',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
        size: 466 * 1024 * 1024, // ~466MB
        filename: 'ggml-small.bin'
      },
      'medium': {
        id: 'medium',
        name: 'Whisper Medium',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
        size: 1500 * 1024 * 1024, // ~1.5GB
        filename: 'ggml-medium.bin'
      },
      'large-v3-turbo': {
        id: 'large-v3-turbo',
        name: 'Whisper Large V3 Turbo',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin',
        size: 1550 * 1024 * 1024, // ~1.55GB
        filename: 'ggml-large-v3-turbo.bin'
      }
    };
    this.activeDownloads = new Map();
    this.whisperInstance = null;
  }

  async init() {
    // Ensure models directory exists
    try {
      await fs.mkdir(this.modelDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create models directory:', error);
    }
  }

  async downloadModel(modelId, progressCallback) {
    if (this.activeDownloads.has(modelId)) {
      throw new Error(`Model ${modelId} is already being downloaded`);
    }

    const model = this.availableModels[modelId];
    if (!model) {
      throw new Error(`Unknown model: ${modelId}`);
    }

    const modelPath = path.join(this.modelDir, model.filename);
    
    // Check if model already exists
    try {
      await fs.access(modelPath);
      return { success: true, path: modelPath, message: 'Model already exists' };
    } catch {
      // Model doesn't exist, proceed with download
    }

    this.activeDownloads.set(modelId, true);

    try {
      // For development/testing, simulate download with fake file creation
      if (!whisper) {
        console.warn('Whisper not available, simulating model download');
        
        // Simulate download progress
        for (let progress = 0; progress <= 100; progress += 10) {
          if (progressCallback) {
            progressCallback({ 
              modelId, 
              progress, 
              downloadedSize: Math.floor((progress / 100) * model.size),
              totalSize: model.size 
            });
          }
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        // Create a dummy model file for testing
        await fs.writeFile(modelPath, `Mock model file for ${model.name}\nThis is a placeholder for development testing.`);
        
        this.activeDownloads.delete(modelId);
        
        return { 
          success: true, 
          path: modelPath, 
          message: `Mock download completed for ${model.name}` 
        };
      }

      // Real download implementation
      const response = await fetch(model.url);
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
          const { done, value } = await reader.read();
          
          if (done) break;
          
          downloadedSize += value.length;
          stream.write(value);
          
          const progress = Math.round((downloadedSize / totalSize) * 100);
          if (progressCallback) {
            progressCallback({ modelId, progress, downloadedSize, totalSize });
          }
        }
        
        await stream.end();
        await fileHandle.close();
        
        this.activeDownloads.delete(modelId);
        
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
      throw new Error(`Failed to download ${model.name}: ${error.message}`);
    }
  }

  async getModelStatus() {
    const status = {};
    
    for (const [modelId, model] of Object.entries(this.availableModels)) {
      const modelPath = path.join(this.modelDir, model.filename);
      
      try {
        await fs.access(modelPath);
        status[modelId] = {
          downloaded: true,
          path: modelPath,
          size: (await fs.stat(modelPath)).size,
          downloading: this.activeDownloads.has(modelId)
        };
      } catch {
        status[modelId] = {
          downloaded: false,
          path: null,
          size: 0,
          downloading: this.activeDownloads.has(modelId)
        };
      }
    }
    
    return status;
  }

  async initializeWhisper(modelId) {
    if (!whisper) {
      throw new Error('Whisper is not available. Please ensure whisper-node is properly installed.');
    }

    const model = this.availableModels[modelId];
    if (!model) {
      throw new Error(`Unknown model: ${modelId}`);
    }

    const modelPath = path.join(this.modelDir, model.filename);
    
    try {
      await fs.access(modelPath);
    } catch {
      throw new Error(`Model ${modelId} is not downloaded`);
    }

    try {
      this.whisperInstance = await whisper(modelPath);
      return { success: true, modelId };
    } catch (error) {
      throw new Error(`Failed to initialize Whisper with model ${modelId}: ${error.message}`);
    }
  }

  async transcribeAudio(audioPath, options = {}) {
    if (!whisper) {
      // For development/testing, return a mock transcription
      console.warn('Whisper not available, returning mock transcription');
      return {
        success: true,
        text: `Mock transcription for audio file: ${path.basename(audioPath)}. This is a test transcription that would normally be generated by Whisper AI.`,
        segments: [],
        language: options.language || 'en'
      };
    }

    if (!this.whisperInstance) {
      throw new Error('Whisper instance not initialized. Please select a model first.');
    }

    try {
      const result = await this.whisperInstance(audioPath, {
        language: options.language || 'auto',
        task: 'transcribe',
        verbose: false,
        ...options
      });

      return {
        success: true,
        text: result.transcription || result,
        segments: result.segments || [],
        language: result.language || options.language || 'auto'
      };
    } catch (error) {
      throw new Error(`Transcription failed: ${error.message}`);
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
      return { success: true, message: `Deleted ${model.name}` };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { success: true, message: `Model ${model.name} was not found` };
      }
      throw new Error(`Failed to delete ${model.name}: ${error.message}`);
    }
  }

  isDownloading(modelId) {
    return this.activeDownloads.has(modelId);
  }

  cancelDownload(modelId) {
    this.activeDownloads.delete(modelId);
    // Note: This is a simple cancellation. In a production app, 
    // you might want to actually abort the fetch request
  }

  getAvailableModels() {
    return Object.values(this.availableModels).map(model => ({
      id: model.id,
      name: model.name,
      size: model.size
    }));
  }
}

module.exports = WhisperService;