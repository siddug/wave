const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Store operations
  store: {
    get: (key) => ipcRenderer.invoke('store:get', key),
    set: (key, value) => ipcRenderer.invoke('store:set', key, value),
    delete: (key) => ipcRenderer.invoke('store:delete', key),
    clear: () => ipcRenderer.invoke('store:clear'),
    has: (key) => ipcRenderer.invoke('store:has', key),
    
    // Listen for store changes
    onChanged: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('store:changed', handler);
      return () => ipcRenderer.removeListener('store:changed', handler);
    },
    onDeleted: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('store:deleted', handler);
      return () => ipcRenderer.removeListener('store:deleted', handler);
    },
    onCleared: (callback) => {
      const handler = () => callback();
      ipcRenderer.on('store:cleared', handler);
      return () => ipcRenderer.removeListener('store:cleared', handler);
    }
  },

  // File operations
  files: {
    save: (fileName, data) => ipcRenderer.invoke('files:save', fileName, data),
    read: (fileName) => ipcRenderer.invoke('files:read', fileName),
    readAudio: (audioPath) => ipcRenderer.invoke('files:read-audio', audioPath),
    delete: (fileName) => ipcRenderer.invoke('files:delete', fileName)
  },

  // Permissions
  permissions: {
    checkAccessibility: () => ipcRenderer.invoke('check-accessibility-permission'),
    requestAccessibility: () => ipcRenderer.invoke('request-accessibility-permission'),
    openAccessibilitySettings: () => ipcRenderer.invoke('open-accessibility-settings'),
    checkMicrophone: () => ipcRenderer.invoke('check-microphone-permission'),
    requestMicrophone: () => ipcRenderer.invoke('request-microphone-permission'),
    openMicrophoneSettings: () => ipcRenderer.invoke('open-microphone-settings'),
    
    // Listen for microphone trigger
    onMicrophoneTrigger: (callback) => {
      const handler = () => callback();
      ipcRenderer.on('trigger-microphone-request', handler);
      return () => ipcRenderer.removeListener('trigger-microphone-request', handler);
    },
    
    // Listen for permission changes
    onPermissionsChanged: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('permissions:changed', handler);
      return () => ipcRenderer.removeListener('permissions:changed', handler);
    }
  },

  // Setup
  setup: {
    complete: () => ipcRenderer.invoke('complete-setup'),
    isComplete: () => ipcRenderer.invoke('is-setup-complete')
  },

  // Recording with keyboard shortcuts and Whisper
  recording: {
    start: () => ipcRenderer.invoke('recording:start'),
    stop: () => ipcRenderer.invoke('recording:stop'),
    transcribe: (audioData) => ipcRenderer.invoke('recording:transcribe', audioData),
    pasteText: (text) => ipcRenderer.invoke('recording:paste-text', text),
    save: (recordingData) => ipcRenderer.invoke('recording:save', recordingData),
    getRecordings: (params) => ipcRenderer.invoke('get-recordings', params),
    deleteRecording: (recordingId) => ipcRenderer.invoke('delete-recording', recordingId),
    
    // New method for pill to send audio data to main process
    sendAudioToMain: (audioBuffer) => ipcRenderer.invoke('recording:audio-ready', audioBuffer),
    
    // Listen for recording state changes
    onStateUpdate: (callback) => {
      const handler = (event, state) => callback(state);
      ipcRenderer.on('recording-state-update', handler);
      return () => ipcRenderer.removeListener('recording-state-update', handler);
    },
    
    // Listen for stop recording command from main
    onStopAndTranscribe: (callback) => {
      const handler = () => callback();
      ipcRenderer.on('stop-recording-and-transcribe', handler);
      return () => ipcRenderer.removeListener('stop-recording-and-transcribe', handler);
    },
    
    // Listen for transcription completion
    onTranscriptionComplete: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('transcription-complete', handler);
      return () => ipcRenderer.removeListener('transcription-complete', handler);
    },
    
    // Listen for recording completion (for real-time UI updates)
    onRecordingComplete: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('recording-complete', handler);
      return () => ipcRenderer.removeListener('recording-complete', handler);
    }
  },

  // Navigation
  navigation: {
    navigateTo: (route) => ipcRenderer.invoke('navigate-to', route),
    
    // Listen for navigation events
    onNavigate: (callback) => {
      const handler = (event, route) => callback(route);
      ipcRenderer.on('navigate-to', handler);
      return () => ipcRenderer.removeListener('navigate-to', handler);
    }
  },

  // Models
  models: {
    download: (modelId) => ipcRenderer.invoke('model:download', modelId),
    getStatus: () => ipcRenderer.invoke('model:get-status'),
    select: (modelId) => ipcRenderer.invoke('model:select', modelId),
    delete: (modelId) => ipcRenderer.invoke('model:delete', modelId),
    pause: (modelId) => ipcRenderer.invoke('model:pause', modelId),
    resume: (modelId) => ipcRenderer.invoke('model:resume', modelId),
    cancel: (modelId) => ipcRenderer.invoke('model:cancel', modelId),
    
    // Listen for model events
    onDownloadProgress: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('model:download-progress', handler);
      return () => ipcRenderer.removeListener('model:download-progress', handler);
    },
    onDownloadComplete: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('model:download-complete', handler);
      return () => ipcRenderer.removeListener('model:download-complete', handler);
    }
  },

  // Data operations with pagination and timestamp support
  data: {
    query: (options) => ipcRenderer.invoke('data:query', options),
    add: (item) => ipcRenderer.invoke('data:add', item),
    update: (id, updates) => ipcRenderer.invoke('data:update', id, updates),
    delete: (id) => ipcRenderer.invoke('data:delete', id),
    cleanup: (olderThan) => ipcRenderer.invoke('data:cleanup', olderThan),
    
    // Listen for data changes
    onAdded: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('data:added', handler);
      return () => ipcRenderer.removeListener('data:added', handler);
    },
    onUpdated: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('data:updated', handler);
      return () => ipcRenderer.removeListener('data:updated', handler);
    },
    onDeleted: (callback) => {
      const handler = (event, id) => callback(id);
      ipcRenderer.on('data:deleted', handler);
      return () => ipcRenderer.removeListener('data:deleted', handler);
    },
    onCleanupCompleted: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('data:cleanup-completed', handler);
      return () => ipcRenderer.removeListener('data:cleanup-completed', handler);
    }
  },
  
  // Shortcuts management
  shortcuts: {
    updateShortcuts: (shortcuts) => ipcRenderer.invoke('shortcuts:update', shortcuts),
    startRecording: (shortcutType) => ipcRenderer.invoke('shortcuts:start-recording', shortcutType),
    
    // Listen for shortcut recording events
    onShortcutRecorded: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('shortcut-recorded', handler);
      return () => ipcRenderer.removeListener('shortcut-recorded', handler);
    }
  },
  
  // Settings management  
  settings: {
    updateRecordingSettings: (settings) => ipcRenderer.invoke('settings:update-recording', settings)
  },
  
  // App management
  app: {
    setStartAtLogin: (enabled) => ipcRenderer.invoke('app:set-start-at-login', enabled),
    openLogsFolder: () => ipcRenderer.invoke('open-logs-folder')
  },
  
  // Voxtral (Node.js transcription)
  voxtral: {
    // Check if supported (always true with Node.js backend)
    checkWebGPU: () => ipcRenderer.invoke('voxtral:check-webgpu'),
    // Download/load the model
    download: () => ipcRenderer.invoke('voxtral:download'),
    // Get model status
    getStatus: () => ipcRenderer.invoke('voxtral:get-status'),
    // Select as active model
    select: () => ipcRenderer.invoke('voxtral:select'),
    // Delete model cache
    delete: () => ipcRenderer.invoke('voxtral:delete'),
    // Preload model into memory
    preload: () => ipcRenderer.invoke('voxtral:preload'),

    // Event listeners for download progress
    onDownloadProgress: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('voxtral:download-progress', handler);
      return () => ipcRenderer.removeListener('voxtral:download-progress', handler);
    },
    onDownloadComplete: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('voxtral:download-complete', handler);
      return () => ipcRenderer.removeListener('voxtral:download-complete', handler);
    }
  },

  // LLM Models
  llm: {
    getAvailableModels: () => ipcRenderer.invoke('llm:get-available-models'),
    getStatus: () => ipcRenderer.invoke('llm:get-status'),
    download: (modelId) => ipcRenderer.invoke('llm:download', modelId),
    select: (modelId) => ipcRenderer.invoke('llm:select', modelId),
    delete: (modelId) => ipcRenderer.invoke('llm:delete', modelId),
    generate: (prompt, options) => ipcRenderer.invoke('llm:generate', prompt, options),
    getSelected: () => ipcRenderer.invoke('llm:get-selected'),
    testInference: () => ipcRenderer.invoke('llm:test-inference'),
    cancel: (modelId) => ipcRenderer.invoke('llm:cancel', modelId),
    
    // Listen for LLM events
    onDownloadProgress: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('llm:download-progress', handler);
      return () => ipcRenderer.removeListener('llm:download-progress', handler);
    },
    onDownloadComplete: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('llm:download-complete', handler);
      return () => ipcRenderer.removeListener('llm:download-complete', handler);
    }
  }
});