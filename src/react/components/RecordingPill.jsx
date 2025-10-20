import React, { useRef, useState, useEffect } from "react";

// Animated AudioWave for recording state
const AudioWave = ({ smaller = false }) => {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhase((prev) => prev + 1);
    }, 100); // 10 FPS
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`flex space-x-1 items-center justify-center h-6`}>
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className={`w-1 ${
            smaller ? "bg-gray-600" : "bg-sky-400"
          } rounded transition-colors`}
          style={{
            height: `${8 + Math.abs(Math.sin(phase / 2 + i)) * 12}px`,
            transition: "height 0.2s",
          }}
        />
      ))}
    </div>
  );
};

// Processing pulse animation
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
    <div className="flex space-x-1 items-center justify-center h-6">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="w-1 bg-orange-400 rounded"
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

  // Listen for recording state updates from main process
  useEffect(() => {
    if (!window.electronAPI?.recording?.onStateUpdate) return;

    const unsubscribeState = window.electronAPI.recording.onStateUpdate(
      (state) => {
        console.log("[PILL] Recording state update:", state);

        // Always sync state immediately to prevent stuck states
        setRecording(state.recording || false);
        setProcessing(state.transcribing || false);

        if (state.recording && !recording) {
          startRecording();
        } else if (state.transcribing && recording) {
          // Stop recording and start processing
          stopRecording();
        } else if (
          !state.recording &&
          !state.transcribing &&
          (recording || processing)
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
  }, [recording, processing]);

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
    <div className="fixed left-0 top-0 bg-black/80 backdrop-blur-sm rounded-full px-2 py-1 flex items-center justify-center w-full h-full">
      <div className="flex items-center gap-3">
        <AudioWave />
        {recording && (
          <div className="text-red-400 flex items-center justify-center">
            <i className="ri-stop-fill text-sm"></i>
          </div>
        )}

        {processing && !recording && (
          <div className="text-sky-400 flex items-center justify-center animate-spin">
            <i className="ri-loader-4-line text-sm"></i>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecordingPill;
