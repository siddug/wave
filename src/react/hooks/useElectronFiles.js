import { useCallback, useState } from 'react';

// Hook to interact with electron file system
export const useElectronFiles = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Save file
  const saveFile = useCallback(async (fileName, data) => {
    try {
      setLoading(true);
      setError(null);
      const result = await window.electronAPI.files.save(fileName, data);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Read file
  const readFile = useCallback(async (fileName) => {
    try {
      setLoading(true);
      setError(null);
      const result = await window.electronAPI.files.read(fileName);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      return result.data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Delete file
  const deleteFile = useCallback(async (fileName) => {
    try {
      setLoading(true);
      setError(null);
      const result = await window.electronAPI.files.delete(fileName);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Save audio file with metadata
  const saveAudioFile = useCallback(async (audioData, metadata = {}) => {
    const timestamp = Date.now();
    const fileName = `audio_${timestamp}.wav`;
    
    try {
      const saveResult = await saveFile(fileName, audioData);
      
      // Also save metadata to data store
      const audioRecord = {
        type: 'audio',
        fileName,
        filePath: saveResult.path,
        timestamp,
        ...metadata
      };
      
      // Note: This would typically be handled by useElectronData hook
      // For now, we return the record for the caller to save
      return { audioRecord, filePath: saveResult.path };
    } catch (err) {
      throw err;
    }
  }, [saveFile]);

  // Save generic file with metadata
  const saveFileWithMetadata = useCallback(async (fileName, data, metadata = {}) => {
    try {
      const saveResult = await saveFile(fileName, data);
      
      // Create file record
      const fileRecord = {
        type: 'file',
        fileName,
        filePath: saveResult.path,
        timestamp: Date.now(),
        ...metadata
      };
      
      return { fileRecord, filePath: saveResult.path };
    } catch (err) {
      throw err;
    }
  }, [saveFile]);

  return {
    loading,
    error,
    saveFile,
    readFile,
    deleteFile,
    saveAudioFile,
    saveFileWithMetadata
  };
};