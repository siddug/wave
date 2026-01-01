/**
 * Voxtral Service - Handles Voxtral Mini 3B model loading and transcription
 * Runs in main process using transformers.js for Node.js
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { app } = require('electron');

// Dynamic import for ESM transformers.js package
let VoxtralForConditionalGeneration = null;
let VoxtralProcessor = null;
let env = null;

/**
 * Decode WAV file to Float32Array samples
 * @param {string} filePath - Path to WAV file
 * @param {number} targetSampleRate - Target sample rate (default 16000 for Voxtral)
 * @returns {Float32Array} Audio samples
 */
async function decodeWavFile(filePath, targetSampleRate = 16000) {
  const buffer = await fs.readFile(filePath);

  console.log('[VOXTRAL] Audio file size:', buffer.length, 'bytes');
  console.log('[VOXTRAL] First 16 bytes:', buffer.slice(0, 16).toString('hex'));

  // Parse WAV header
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  // Check RIFF header
  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  console.log('[VOXTRAL] RIFF header:', riff, '(expected: RIFF)');

  if (riff !== 'RIFF') {
    // Try to detect format
    const firstBytes = buffer.slice(0, 4).toString('hex');
    throw new Error(`Invalid WAV file: missing RIFF header. Got: ${firstBytes} (${riff})`);
  }

  // Check WAVE format
  const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
  if (wave !== 'WAVE') {
    throw new Error('Invalid WAV file: missing WAVE format');
  }

  // Find fmt chunk
  let offset = 12;
  let audioFormat, numChannels, sampleRate, bitsPerSample;
  let dataOffset = 0, dataSize = 0;

  while (offset < buffer.length - 8) {
    const chunkId = String.fromCharCode(
      view.getUint8(offset), view.getUint8(offset + 1),
      view.getUint8(offset + 2), view.getUint8(offset + 3)
    );
    const chunkSize = view.getUint32(offset + 4, true);

    if (chunkId === 'fmt ') {
      audioFormat = view.getUint16(offset + 8, true);
      numChannels = view.getUint16(offset + 10, true);
      sampleRate = view.getUint32(offset + 12, true);
      bitsPerSample = view.getUint16(offset + 22, true);
    } else if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataSize = chunkSize;
      break;
    }

    offset += 8 + chunkSize;
    // Align to even byte
    if (chunkSize % 2 !== 0) offset++;
  }

  if (!dataOffset) {
    throw new Error('Invalid WAV file: missing data chunk');
  }

  console.log(`[VOXTRAL] WAV: ${sampleRate}Hz, ${numChannels}ch, ${bitsPerSample}bit, ${dataSize} bytes`);

  // Convert to Float32Array
  const bytesPerSample = bitsPerSample / 8;
  const numSamples = dataSize / (bytesPerSample * numChannels);
  const samples = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    let sample = 0;
    // Average all channels to mono
    for (let ch = 0; ch < numChannels; ch++) {
      const sampleOffset = dataOffset + (i * numChannels + ch) * bytesPerSample;

      if (bitsPerSample === 16) {
        sample += view.getInt16(sampleOffset, true) / 32768;
      } else if (bitsPerSample === 32 && audioFormat === 3) {
        // Float32
        sample += view.getFloat32(sampleOffset, true);
      } else if (bitsPerSample === 32) {
        sample += view.getInt32(sampleOffset, true) / 2147483648;
      } else if (bitsPerSample === 8) {
        sample += (view.getUint8(sampleOffset) - 128) / 128;
      }
    }
    samples[i] = sample / numChannels;
  }

  // Resample if needed
  if (sampleRate !== targetSampleRate) {
    console.log(`[VOXTRAL] Resampling from ${sampleRate}Hz to ${targetSampleRate}Hz`);
    const ratio = sampleRate / targetSampleRate;
    const newLength = Math.floor(numSamples / ratio);
    const resampled = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const srcIdx = i * ratio;
      const srcIdxFloor = Math.floor(srcIdx);
      const srcIdxCeil = Math.min(srcIdxFloor + 1, numSamples - 1);
      const t = srcIdx - srcIdxFloor;
      // Linear interpolation
      resampled[i] = samples[srcIdxFloor] * (1 - t) + samples[srcIdxCeil] * t;
    }

    return resampled;
  }

  return samples;
}

class VoxtralService {
  constructor() {
    this.modelDir = path.join(app.getPath('userData'), 'models', 'voxtral');
    this.isLoading = false;
    this.isReady = false;
    this.loadProgress = 0;
    this.model = null;
    this.processor = null;
    this.MODEL_ID = 'onnx-community/Voxtral-Mini-3B-2507-ONNX';
  }

  async init() {
    // Ensure models directory exists
    try {
      await fs.mkdir(this.modelDir, { recursive: true });
      console.log('[VOXTRAL] Model directory:', this.modelDir);
    } catch (error) {
      console.error('[VOXTRAL] Failed to create models directory:', error);
    }

    // Initialize transformers.js
    await this.initTransformers();
  }

  async initTransformers() {
    if (VoxtralForConditionalGeneration) return;

    try {
      console.log('[VOXTRAL] Loading transformers.js...');
      const transformers = await import('@huggingface/transformers');
      VoxtralForConditionalGeneration = transformers.VoxtralForConditionalGeneration;
      VoxtralProcessor = transformers.VoxtralProcessor;
      env = transformers.env;

      // Configure cache directory
      env.cacheDir = this.modelDir;
      env.allowLocalModels = true;

      console.log('[VOXTRAL] transformers.js loaded successfully');
    } catch (error) {
      console.error('[VOXTRAL] Failed to load transformers.js:', error);
      throw error;
    }
  }

  /**
   * Load model from cache only (no downloading)
   */
  async loadModelFromCache() {
    if (this.isReady && this.model && this.processor) {
      console.log('[VOXTRAL] Model already loaded');
      return { success: true };
    }

    if (this.isLoading) {
      // Wait for loading to complete
      while (this.isLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return { success: this.isReady };
    }

    this.isLoading = true;

    try {
      await this.initTransformers();

      console.log('[VOXTRAL] Loading model from cache...');
      console.log('[VOXTRAL] Model ID:', this.MODEL_ID);

      // Load processor and model from cache only
      this.processor = await VoxtralProcessor.from_pretrained(this.MODEL_ID, {
        local_files_only: true,
      });

      this.model = await VoxtralForConditionalGeneration.from_pretrained(
        this.MODEL_ID,
        {
          dtype: {
            embed_tokens: 'q4',
            audio_encoder: 'q4',
            decoder_model_merged: 'q4',
          },
          device: 'cpu',
          local_files_only: true,
        }
      );

      this.isReady = true;
      this.isLoading = false;
      this.loadProgress = 100;

      console.log('[VOXTRAL] Model loaded from cache successfully');
      return { success: true };
    } catch (error) {
      this.isLoading = false;
      console.error('[VOXTRAL] Failed to load model from cache:', error.message);
      throw error;
    }
  }

  /**
   * Download model (or load from cache if already downloaded)
   * @param {Function} progressCallback - Progress callback
   * @param {boolean} forceRedownload - If true, clears cache first
   */
  async downloadModel(progressCallback, forceRedownload = false) {
    if (this.isLoading) {
      throw new Error('Model is already being downloaded');
    }

    this.isLoading = true;
    this.loadProgress = 0;

    // Track download progress across multiple files
    const fileProgress = new Map();
    let lastReportedProgress = 0;

    const progressHandler = (progress) => {
      const file = progress.file || 'unknown';

      // Track per-file progress
      if (progress.loaded !== undefined && progress.total !== undefined) {
        fileProgress.set(file, {
          loaded: progress.loaded,
          total: progress.total
        });
      }

      // Calculate overall progress across all files
      let totalLoaded = 0;
      let totalSize = 0;
      for (const [, fp] of fileProgress) {
        totalLoaded += fp.loaded || 0;
        totalSize += fp.total || 0;
      }

      const percent = totalSize > 0 ? Math.min(99, Math.round((totalLoaded / totalSize) * 100)) : 0;
      this.loadProgress = percent;

      // Only report if progress changed significantly
      if (percent !== lastReportedProgress) {
        lastReportedProgress = percent;
        console.log(`[VOXTRAL] Download progress: ${percent}% (${(totalLoaded / 1024 / 1024).toFixed(1)}MB / ${(totalSize / 1024 / 1024).toFixed(1)}MB)`);

        if (progressCallback) {
          progressCallback({
            modelId: 'voxtral-mini',
            progress: percent,
            status: progress.status || 'downloading',
            file: file
          });
        }
      }
    };

    try {
      await this.initTransformers();

      // Clear corrupted cache if force redownload
      if (forceRedownload) {
        console.log('[VOXTRAL] Force redownload - clearing cache...');
        await this.clearCache();
      }

      console.log('[VOXTRAL] Starting model download/load...');
      console.log('[VOXTRAL] Model ID:', this.MODEL_ID);
      console.log('[VOXTRAL] Cache dir:', this.modelDir);

      // Load processor first
      console.log('[VOXTRAL] Loading processor...');
      this.processor = await VoxtralProcessor.from_pretrained(this.MODEL_ID, {
        progress_callback: progressHandler,
      });

      // Load model with q4 quantization for smaller size
      console.log('[VOXTRAL] Loading model...');
      this.model = await VoxtralForConditionalGeneration.from_pretrained(
        this.MODEL_ID,
        {
          dtype: {
            embed_tokens: 'q4',
            audio_encoder: 'q4',
            decoder_model_merged: 'q4',
          },
          device: 'cpu',
          progress_callback: progressHandler,
        }
      );

      this.isReady = true;
      this.isLoading = false;
      this.loadProgress = 100;

      console.log('[VOXTRAL] Model loaded successfully');

      if (progressCallback) {
        progressCallback({
          modelId: 'voxtral-mini',
          progress: 100,
          status: 'ready'
        });
      }

      return { success: true };
    } catch (error) {
      this.isLoading = false;
      this.loadProgress = 0;
      console.error('[VOXTRAL] Model download/load failed:', error);
      throw error;
    }
  }

  async transcribeAudio(audioPath, options = {}) {
    // Auto-load model if not ready
    if (!this.isReady || !this.model || !this.processor) {
      console.log('[VOXTRAL] Model not loaded, attempting to load from cache...');
      try {
        await this.loadModelFromCache();
      } catch (error) {
        throw new Error('Voxtral model not available. Please download the model first.');
      }
    }

    const language = options.language || 'en';
    console.log('[VOXTRAL] Starting transcription, language:', language);
    console.log('[VOXTRAL] Audio file:', audioPath);
    const startTime = Date.now();

    try {
      // Decode WAV file to Float32Array at 16kHz
      const audioData = await decodeWavFile(audioPath, 16000);
      console.log('[VOXTRAL] Audio loaded, samples:', audioData.length, 'duration:', (audioData.length / 16000).toFixed(2), 's');

      // Prepare conversation for transcription
      const conversation = [
        {
          role: 'user',
          content: [
            { type: 'audio' },
            { type: 'text', text: `lang:${language} [TRANSCRIBE]` },
          ],
        }
      ];

      // Apply chat template and process inputs
      const text = this.processor.apply_chat_template(conversation, { tokenize: false });
      const inputs = await this.processor(text, audioData);

      // Generate transcription with temperature 0 for deterministic output
      const generatedIds = await this.model.generate({
        ...inputs,
        max_new_tokens: 256,
        temperature: 0.0,
      });

      // Decode the generated tokens
      const newTokens = generatedIds.slice(null, [inputs.input_ids.dims.at(-1), null]);
      const generatedTexts = this.processor.batch_decode(newTokens, { skip_special_tokens: true });
      const transcribedText = generatedTexts[0] || '';

      const duration = Date.now() - startTime;
      console.log(`[VOXTRAL] Transcription complete in ${duration}ms`);
      console.log(`[VOXTRAL] Result: "${transcribedText}"`);

      return {
        success: true,
        text: transcribedText.trim(),
        language: language
      };
    } catch (error) {
      console.error('[VOXTRAL] Transcription failed:', error);
      throw error;
    }
  }

  async getStatus() {
    // Check if model is already loaded
    if (this.isReady) {
      return {
        downloaded: true,
        isReady: true,
        isLoading: false,
        progress: 100
      };
    }

    // Check default HuggingFace cache location
    const homeDir = require('os').homedir();
    const hfCacheDir = path.join(homeDir, '.cache', 'huggingface', 'hub');

    let downloaded = false;

    try {
      // Check if model directory exists in HF cache
      const modelCacheName = `models--${this.MODEL_ID.replace('/', '--')}`;
      const modelCachePath = path.join(hfCacheDir, modelCacheName);

      await fs.access(modelCachePath);
      const files = await fs.readdir(modelCachePath);
      downloaded = files.length > 0;

      if (downloaded) {
        console.log('[VOXTRAL] Model found in HF cache:', modelCachePath);
      }
    } catch {
      downloaded = false;
    }

    // Also check our custom directory
    if (!downloaded) {
      try {
        const files = await fs.readdir(this.modelDir);
        downloaded = files.length > 0;
      } catch {
        downloaded = false;
      }
    }

    return {
      downloaded: downloaded,
      isReady: this.isReady,
      isLoading: this.isLoading,
      progress: this.loadProgress
    };
  }

  /**
   * Clear cache without throwing (for internal use during download)
   */
  async clearCache() {
    // Unload model from memory
    this.model = null;
    this.processor = null;
    this.isReady = false;

    // Delete from HuggingFace cache
    const homeDir = require('os').homedir();
    const hfCacheDir = path.join(homeDir, '.cache', 'huggingface', 'hub');
    const modelCacheName = `models--${this.MODEL_ID.replace('/', '--')}`;
    const modelCachePath = path.join(hfCacheDir, modelCacheName);

    try {
      await fs.rm(modelCachePath, { recursive: true, force: true });
      console.log('[VOXTRAL] Cleared HF cache:', modelCachePath);
    } catch (e) {
      console.log('[VOXTRAL] HF cache not found or already deleted');
    }

    // Also delete our custom cache directory
    try {
      await fs.rm(this.modelDir, { recursive: true, force: true });
      await fs.mkdir(this.modelDir, { recursive: true });
    } catch (e) {
      // Ignore
    }
  }

  async deleteModel() {
    if (this.isLoading) {
      throw new Error('Cannot delete model while downloading');
    }

    try {
      await this.clearCache();
      console.log('[VOXTRAL] Model deleted');
      return { success: true };
    } catch (error) {
      console.error('[VOXTRAL] Failed to delete model:', error);
      throw error;
    }
  }

  async preloadModel() {
    if (this.isReady) {
      console.log('[VOXTRAL] Model already loaded');
      return { success: true };
    }

    if (this.isLoading) {
      console.log('[VOXTRAL] Model already loading');
      return { success: true, message: 'Already loading' };
    }

    // Try to load from cache
    try {
      return await this.loadModelFromCache();
    } catch (error) {
      console.log('[VOXTRAL] Preload failed - model not in cache');
      return { success: false, message: 'Model not downloaded' };
    }
  }

  unloadModel() {
    this.model = null;
    this.processor = null;
    this.isReady = false;
    console.log('[VOXTRAL] Model unloaded from memory');
    return { success: true };
  }
}

module.exports = VoxtralService;
