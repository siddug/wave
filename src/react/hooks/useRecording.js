import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';

export const useRecording = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingId, setRecordingId] = useState(null);
  const [recordings, setRecordings] = useState([]);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Load existing recordings on mount
  useEffect(() => {
    loadRecordings();
    
    // Listen for recording state updates from main process
    const unsubscribeState = window.electronAPI?.recording?.onStateUpdate((state) => {
      setIsRecording(state.recording || false);
      setIsTranscribing(state.transcribing || false);
      if (state.recordingId) {
        setRecordingId(state.recordingId);
      }
    });

    // Listen for transcription completion
    const unsubscribeTranscription = window.electronAPI?.recording?.onTranscriptionComplete((data) => {
      loadRecordings();
      toast.success('Recording transcribed successfully!');
      setRecordingId(null);
    });

    return () => {
      if (unsubscribeState) unsubscribeState();
      if (unsubscribeTranscription) unsubscribeTranscription();
    };
  }, []);

  const loadRecordings = useCallback(async () => {
    try {
      const result = await window.electronAPI?.recording?.getRecordings();
      console.log('loadRecordings - Full result:', result);
      if (result && result.success) {
        console.log('loadRecordings - Setting recordings:', result.recordings);
        setRecordings(result.recordings);
      }
    } catch (error) {
      console.error('Failed to load recordings:', error);
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      // Check microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Start recording in main process
      const result = await window.electronAPI?.recording?.start();
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to start recording');
      }

      // Setup MediaRecorder for web audio capture
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        if (recordingId) {
          try {
            // Save audio file
            const saveResult = await window.electronAPI?.recording?.saveAudio(recordingId, audioBlob);
            if (saveResult?.success) {
              // Start transcription
              const transcribeResult = await window.electronAPI?.recording?.transcribe(recordingId);
              if (!transcribeResult?.success) {
                toast.error('Transcription failed: ' + transcribeResult?.error);
              }
            } else {
              toast.error('Failed to save audio file');
            }
          } catch (error) {
            toast.error('Failed to process recording');
            console.error('Recording processing error:', error);
          }
        }

        // Clean up
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setRecordingId(result.recordingId);
      
    } catch (error) {
      toast.error('Failed to start recording: ' + error.message);
      console.error('Recording start error:', error);
    }
  }, [recordingId]);

  const stopRecording = useCallback(async () => {
    try {
      // Stop main process recording
      const result = await window.electronAPI?.recording?.stop();
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to stop recording');
      }

      // Stop MediaRecorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      
    } catch (error) {
      toast.error('Failed to stop recording: ' + error.message);
      console.error('Recording stop error:', error);
    }
  }, []);

  const deleteRecording = useCallback(async (recordingId) => {
    try {
      const result = await window.electronAPI?.recording?.deleteRecording(recordingId);
      if (result?.success) {
        await loadRecordings();
        toast.success('Recording deleted');
      } else {
        throw new Error(result?.error || 'Failed to delete recording');
      }
    } catch (error) {
      toast.error('Failed to delete recording: ' + error.message);
      console.error('Recording delete error:', error);
    }
  }, [loadRecordings]);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return {
    isRecording,
    isTranscribing,
    recordingId,
    recordings,
    startRecording,
    stopRecording,
    toggleRecording,
    deleteRecording,
    loadRecordings
  };
};

export default useRecording;