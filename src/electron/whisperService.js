const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { app } = require('electron');
const { execSync } = require('child_process');

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

  // Check available disk space on macOS
  async checkDiskSpace() {
    try {
      // Use df command to check available space on macOS
      const output = execSync(`df -k "${this.modelDir}" | tail -1 | awk '{print $4}'`, {
        encoding: 'utf8'
      });
      const availableKB = parseInt(output.trim());
      const availableBytes = availableKB * 1024;

      console.log('[WHISPER] Available disk space:', (availableBytes / (1024 * 1024 * 1024)).toFixed(2), 'GB');

      return availableBytes;
    } catch (error) {
      console.error('[WHISPER] Failed to check disk space:', error);
      // Return a conservative estimate if check fails
      return 10 * 1024 * 1024 * 1024; // Assume 10GB available
    }
  }

  async downloadModel(modelId, progressCallback) {
    // Check if already downloading (with more detailed logging)
    if (this.activeDownloads.has(modelId)) {
      const existingDownload = this.activeDownloads.get(modelId);
      console.log(`[WHISPER] Existing download found for ${modelId}:`, {
        cancelled: existingDownload?.cancelled,
        hasAbortController: !!existingDownload?.abortController,
      });

      if (existingDownload && !existingDownload.cancelled) {
        console.log(`[WHISPER] Download already active for ${modelId}, rejecting`);
        throw new Error(`Model ${modelId} is already being downloaded`);
      } else if (existingDownload && existingDownload.cancelled) {
        console.log(`[WHISPER] Previous download was cancelled, cleaning up for ${modelId}`);
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
      console.log(`[WHISPER] Model ${modelId} already exists at ${modelPath}`);
      return { success: true, path: modelPath, message: 'Model already exists' };
    } catch {
      // Model doesn't exist, proceed with download
      console.log(`[WHISPER] Model ${modelId} does not exist, proceeding with download`);
    }

    // Check available disk space before downloading
    const availableSpace = await this.checkDiskSpace();
    const requiredSpace = model.size * 1.2; // Add 20% buffer for safety

    if (availableSpace < requiredSpace) {
      const availableGB = (availableSpace / (1024 * 1024 * 1024)).toFixed(2);
      const requiredGB = (requiredSpace / (1024 * 1024 * 1024)).toFixed(2);

      throw new Error(
        `Insufficient disk space. Available: ${availableGB} GB, Required: ${requiredGB} GB`
      );
    }

    // Create download tracking object with AbortController
    const downloadInfo = {
      modelId,
      cancelled: false,
      abortController: new AbortController(),
      startTime: Date.now()
    };

    console.log(`[WHISPER] Setting download info for ${modelId}`);
    this.activeDownloads.set(modelId, downloadInfo);

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

      // Real download implementation with AbortController
      console.log(`[WHISPER] Starting download for ${modelId}: ${model.url}`);

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

        console.log(`[WHISPER] Download completed for ${modelId}`);

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
        console.log(`[WHISPER] Download cancelled for ${modelId}`);
        throw new Error(`Download cancelled for ${model.name}`);
      }

      console.error(`[WHISPER] Download failed for ${modelId}:`, error);
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
    const downloadInfo = this.activeDownloads.get(modelId);
    return downloadInfo && !downloadInfo.cancelled;
  }

  cancelDownload(modelId) {
    const downloadInfo = this.activeDownloads.get(modelId);
    if (downloadInfo) {
      downloadInfo.cancelled = true;
      downloadInfo.abortController.abort();
      console.log(`[WHISPER] Cancelled download for ${modelId}`);
    }
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