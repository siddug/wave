import React, { useState, useEffect } from 'react';
import { useElectronData } from '../hooks/useElectronData';
import { useElectronFiles } from '../hooks/useElectronFiles';

const AudioPage = () => {
  const { items, loading, error, fetchData, addData, deleteData } = useElectronData();
  const { saveAudioFile, readFile, deleteFile } = useElectronFiles();
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioStream, setAudioStream] = useState(null);

  useEffect(() => {
    fetchData({ filters: { type: 'audio' } });
  }, [fetchData]);

  const audioItems = items.filter(item => item.type === 'audio');

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        const arrayBuffer = await blob.arrayBuffer();
        const audioData = new Uint8Array(arrayBuffer);

        try {
          const { audioRecord } = await saveAudioFile(audioData, {
            title: `Recording ${new Date().toLocaleString()}`,
            duration: Date.now() - startTime,
          });

          addData(audioRecord);
        } catch (err) {
          console.error('Failed to save audio:', err);
        }

        // Cleanup
        stream.getTracks().forEach(track => track.stop());
        setAudioStream(null);
        setMediaRecorder(null);
      };

      const startTime = Date.now();
      recorder.start();
      setMediaRecorder(recorder);
      setAudioStream(stream);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const handleDeleteAudio = async (audioItem) => {
    if (window.confirm('Are you sure you want to delete this audio recording?')) {
      try {
        // Delete file from filesystem
        await deleteFile(audioItem.fileName);
        // Delete from data store
        deleteData(audioItem.id);
      } catch (err) {
        console.error('Failed to delete audio:', err);
      }
    }
  };

  const playAudio = async (audioItem) => {
    try {
      const audioData = await readFile(audioItem.fileName);
      const blob = new Blob([audioData], { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audio.play();

      // Cleanup URL when audio ends
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
      };
    } catch (err) {
      console.error('Failed to play audio:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Audio Recordings</h1>
        
        {/* Recording Controls */}
        <div className="mb-8 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-4">
            {!isRecording ? (
              <button
                onClick={startRecording}
                className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                </svg>
                <span>Start Recording</span>
              </button>
            ) : (
              <div className="flex items-center space-x-4">
                <button
                  onClick={stopRecording}
                  className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded flex items-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                  </svg>
                  <span>Stop Recording</span>
                </button>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-red-600 font-medium">Recording...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading recordings...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            Error: {error}
          </div>
        )}

        {/* Audio List */}
        {!loading && !error && (
          <div className="space-y-4">
            {audioItems.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No audio recordings found. Start recording to create your first audio file!
              </p>
            ) : (
              audioItems.map((audioItem) => (
                <div key={audioItem.id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {audioItem.title || 'Untitled Recording'}
                      </h3>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>File: {audioItem.fileName}</p>
                        {audioItem.duration && (
                          <p>Duration: {Math.round(audioItem.duration / 1000)}s</p>
                        )}
                        <p>Created: {new Date(audioItem.timestamp).toLocaleString()}</p>
                      </div>
                      
                      {audioItem.tags && audioItem.tags.length > 0 && (
                        <div className="flex space-x-2 mt-2">
                          {audioItem.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex space-x-2 ml-4">
                      <button
                        onClick={() => playAudio(audioItem)}
                        className="bg-sky-500 hover:bg-sky-700 text-white font-bold py-2 px-3 rounded text-sm flex items-center space-x-1"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                        <span>Play</span>
                      </button>
                      
                      <button
                        onClick={() => handleDeleteAudio(audioItem)}
                        className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-3 rounded text-sm flex items-center space-x-1"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioPage;