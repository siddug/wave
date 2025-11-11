import React, { useRef, useState, useEffect } from "react";

// Animated AudioWave for recording state - Locus themed
const AudioWave = ({ smaller = false }) => {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhase((prev) => prev + 1);
    }, 100); // 10 FPS
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex gap-sm items-center justify-center h-6">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className={`w-1 ${
            smaller
              ? "bg-text-secondary-light dark:bg-text-secondary-dark"
              : "bg-primary-light dark:bg-primary-dark"
          } rounded-sm transition-colors duration-fast`}
          style={{
            height: `${8 + Math.abs(Math.sin(phase / 2 + i)) * 12}px`,
            transition: "height 0.2s",
          }}
        />
      ))}
    </div>
  );
};

// Processing pulse animation - Locus themed
const ProcessingPulse = () => {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhase((prev) => prev + 1);
    }, 100); // 10 FPS
    return () => clearInterval(interval);
  }, []);

  const height = 8 + Math.abs(Math.sin(phase / 2)) * 12;
  return (
    <div className="flex gap-sm items-center justify-center h-6">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="w-1 bg-warning-light dark:bg-warning-dark rounded-sm"
          style={{
            height: `${height}px`,
            transition: "height 0.2s",
          }}
        />
      ))}
    </div>
  );
};

const RecordingPill = () => {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  // Use refs to track state without triggering re-renders
  const recordingRef = useRef(false);
  const processingRef = useRef(false);

  // Sync refs with state
  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

  useEffect(() => {
    processingRef.current = processing;
  }, [processing]);

  // Listen for recording state updates from main process
  useEffect(() => {
    if (!window.electronAPI?.recording?.onStateUpdate) return;

    const unsubscribeState = window.electronAPI.recording.onStateUpdate(
      (state) => {
        console.log("[PILL] Recording state update:", state);

        // Use refs for comparison to avoid dependency loop
        const currentRecording = recordingRef.current;
        const currentProcessing = processingRef.current;

        // Always sync state immediately to prevent stuck states
        setRecording(state.recording || false);
        setProcessing(state.transcribing || false);

        if (state.recording && !currentRecording) {
          startRecording();
        } else if (state.transcribing && currentRecording) {
          // Stop recording and start processing
          stopRecording();
        } else if (
          !state.recording &&
          !state.transcribing &&
          (currentRecording || currentProcessing)
        ) {
          // Recording complete - reset state and cleanup
          cleanup();
        }
      }
    );

    // Listen for stop command from main process
    const unsubscribeStop = window.electronAPI.recording.onStopAndTranscribe(
      () => {
        console.log("[PILL] Received stop command from main process");
        stopRecording();
      }
    );

    return () => {
      if (unsubscribeState) unsubscribeState();
      if (unsubscribeStop) unsubscribeStop();
    };
  }, []); // Empty dependency array - only set up listeners once

  // Start recording - triggered by state change from main
  const startRecording = async () => {
    console.log("[PILL] Starting audio recording...");
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        console.log(
          "[PILL] MediaRecorder stopped, sending audio to main process..."
        );
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();

        reader.onloadend = async () => {
          if (reader.result && typeof reader.result !== "string") {
            console.log("[PILL] Sending audio buffer to main process...");
            try {
              // Send audio data to main process for transcription
              await window.electronAPI.recording.sendAudioToMain(reader.result);
              console.log("[PILL] Audio sent to main process successfully");
            } catch (err) {
              console.error(
                "[PILL] Failed to send audio to main process:",
                err
              );
              setError("Failed to process audio");
            }
          } else {
            console.error("[PILL] No valid audio buffer");
            setError("No audio buffer available");
          }
        };

        reader.readAsArrayBuffer(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setRecording(true);
      console.log("[PILL] Audio recording started");
    } catch (err) {
      console.error("[PILL] Failed to start recording:", err);
      setError(err?.message || "Could not start recording");
    }
  };

  // Cleanup function to reset all states
  const cleanup = () => {
    console.log("[PILL] Cleaning up recording states...");
    setRecording(false);
    setProcessing(false);
    setError(null);

    // Stop any ongoing recording
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  };

  // Stop recording - triggered by main process command
  const stopRecording = () => {
    console.log("[PILL] Stopping audio recording...");
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
  };

  // Don't render if not recording or processing
  if (!recording && !processing) {
    return null;
  }

  return (
    <div className="fixed left-0 top-0 bg-btn-bg-light/80 dark:bg-btn-bg-dark/80 backdrop-blur-sm rounded-full px-xl py-md flex items-center justify-center w-full h-full transition-all duration-fast">
      <div className="flex items-center gap-lg">
        <AudioWave />
        {recording && (
          <div className="text-error-light dark:text-error-dark flex items-center justify-center transition-colors duration-fast">
            <i className="ri-stop-fill text-base"></i>
          </div>
        )}

        {processing && !recording && (
          <div className="text-primary-light dark:text-primary-dark flex items-center justify-center animate-spin transition-colors duration-fast">
            <i className="ri-loader-4-line text-base"></i>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecordingPill;
