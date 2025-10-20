const { app } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

class AudioService {
  constructor() {
    this.recordingsDir = path.join(app.getPath('userData'), 'recordings');
    this.isRecording = false;
    this.currentRecordingId = null;
    this.recordingStartTime = null;
  }

  async init() {
    // Ensure recordings directory exists
    try {
      await fs.mkdir(this.recordingsDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create recordings directory:', error);
    }
  }

  async startRecording() {
    if (this.isRecording) {
      throw new Error('Already recording');
    }

    this.currentRecordingId = `recording_${Date.now()}`;
    this.recordingStartTime = new Date();
    this.isRecording = true;

    // Return recording session info
    return {
      success: true,
      recordingId: this.currentRecordingId,
      startTime: this.recordingStartTime
    };
  }

  async stopRecording() {
    if (!this.isRecording) {
      throw new Error('Not currently recording');
    }

    const recordingId = this.currentRecordingId;
    const startTime = this.recordingStartTime;
    const endTime = new Date();
    const duration = (endTime - startTime) / 1000; // Duration in seconds

    this.isRecording = false;
    this.currentRecordingId = null;
    this.recordingStartTime = null;

    return {
      success: true,
      recordingId,
      startTime,
      endTime,
      duration
    };
  }

  async saveAudioFile(recordingId, audioBlob) {
    const filename = `${recordingId}.webm`;
    const filepath = path.join(this.recordingsDir, filename);

    try {
      await fs.writeFile(filepath, audioBlob);
      
      // Convert to WAV for Whisper compatibility
      const wavPath = path.join(this.recordingsDir, `${recordingId}.wav`);
      
      return new Promise((resolve, reject) => {
        ffmpeg(filepath)
          .toFormat('wav')
          .audioFrequency(16000) // Whisper prefers 16kHz
          .audioChannels(1) // Mono
          .on('end', () => {
            // Clean up original webm file
            fs.unlink(filepath).catch(console.error);
            resolve({
              success: true,
              path: wavPath,
              recordingId
            });
          })
          .on('error', (error) => {
            reject(new Error(`Audio conversion failed: ${error.message}`));
          })
          .save(wavPath);
      });
    } catch (error) {
      throw new Error(`Failed to save audio file: ${error.message}`);
    }
  }

  async getRecordings() {
    try {
      const files = await fs.readdir(this.recordingsDir);
      const recordings = [];

      for (const file of files) {
        if (path.extname(file) === '.wav') {
          const filepath = path.join(this.recordingsDir, file);
          const stats = await fs.stat(filepath);
          const recordingId = path.basename(file, '.wav');
          
          recordings.push({
            id: recordingId,
            filename: file,
            path: filepath,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
          });
        }
      }

      // Sort by creation time, newest first
      recordings.sort((a, b) => b.created - a.created);
      
      return recordings;
    } catch (error) {
      throw new Error(`Failed to get recordings: ${error.message}`);
    }
  }

  async deleteRecording(recordingId) {
    const filepath = path.join(this.recordingsDir, `${recordingId}.wav`);
    
    try {
      await fs.unlink(filepath);
      return { success: true, message: `Recording ${recordingId} deleted` };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { success: true, message: `Recording ${recordingId} was not found` };
      }
      throw new Error(`Failed to delete recording: ${error.message}`);
    }
  }

  getRecordingPath(recordingId) {
    return path.join(this.recordingsDir, `${recordingId}.wav`);
  }

  isCurrentlyRecording() {
    return this.isRecording;
  }

  getCurrentRecordingInfo() {
    if (!this.isRecording) {
      return null;
    }

    return {
      recordingId: this.currentRecordingId,
      startTime: this.recordingStartTime,
      duration: (new Date() - this.recordingStartTime) / 1000
    };
  }

  async getRecordingDuration(recordingId) {
    const filepath = this.getRecordingPath(recordingId);
    
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filepath, (error, metadata) => {
        if (error) {
          reject(new Error(`Failed to get recording duration: ${error.message}`));
        } else {
          resolve(metadata.format.duration);
        }
      });
    });
  }

  async cleanupOldRecordings(maxAgeInDays = 30) {
    try {
      const recordings = await this.getRecordings();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - maxAgeInDays);

      const toDelete = recordings.filter(recording => recording.created < cutoffDate);
      
      for (const recording of toDelete) {
        await this.deleteRecording(recording.id);
      }

      return {
        success: true,
        deletedCount: toDelete.length,
        message: `Cleaned up ${toDelete.length} old recordings`
      };
    } catch (error) {
      throw new Error(`Failed to cleanup old recordings: ${error.message}`);
    }
  }
}

module.exports = AudioService;