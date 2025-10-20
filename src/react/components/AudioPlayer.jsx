import React, { useState, useRef, useEffect } from "react";

const AudioPlayer = ({
  audioPath,
  audioData,
  title = "Recording",
  onClose,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const audioRef = useRef(null);

  // Load audio data
  useEffect(() => {
    let mounted = true;

    const loadAudio = async () => {
      try {
        setLoading(true);

        if (audioData) {
          // Use provided audio data
          const blob = new Blob([audioData], { type: "audio/wav" });
          const url = URL.createObjectURL(blob);
          if (mounted) {
            setAudioUrl(url);
          }
        } else if (audioPath && window.electronAPI?.files?.readAudio) {
          // Load audio data from file
          const result = await window.electronAPI.files.readAudio(audioPath);
          if (result.success && mounted) {
            const blob = new Blob([result.data], { type: "audio/wav" });
            const url = URL.createObjectURL(blob);
            setAudioUrl(url);
          }
        }
      } catch (error) {
        console.error("Failed to load audio:", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadAudio();

    return () => {
      mounted = false;
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioPath, audioData]);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    const handleLoadStart = () => {
      console.log("Audio load started");
    };

    const handleLoadedMetadata = () => {
      console.log("Audio metadata loaded, duration:", audio.duration);
      const validDuration = audio.duration && isFinite(audio.duration) && !isNaN(audio.duration) ? audio.duration : 0;
      setDuration(validDuration);
    };

    const handleCanPlay = () => {
      console.log("Audio can play");
    };

    const handleTimeUpdate = () => {
      const validCurrentTime = audio.currentTime && isFinite(audio.currentTime) && !isNaN(audio.currentTime) ? audio.currentTime : 0;
      setCurrentTime(validCurrentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = (e) => {
      console.error("Audio error:", e);
    };

    audio.addEventListener("loadstart", handleLoadStart);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    // Force load metadata
    audio.load();

    return () => {
      audio.removeEventListener("loadstart", handleLoadStart);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, [audioUrl]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch((error) => {
        console.error("Audio playback failed:", error);
      });
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio || duration <= 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = percent * duration;
    
    console.log("Seeking to:", newTime, "seconds (", percent * 100, "%)");
    
    if (isFinite(newTime) && !isNaN(newTime)) {
      audio.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    const audio = audioRef.current;
    if (audio) {
      audio.volume = newVolume;
    }
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const formatTime = (timeInSeconds) => {
    if (!timeInSeconds || !isFinite(timeInSeconds) || isNaN(timeInSeconds)) {
      return "0:00";
    }
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (loading) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sky-500"></div>
          <span className="ml-2 text-gray-600">Loading audio...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {audioUrl && (
        <audio 
          ref={audioRef} 
          src={audioUrl} 
          preload="metadata"
          crossOrigin="anonymous"
        />
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Track Info */}
            <div className="flex items-center space-x-4 flex-1 min-w-0">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-sky-600 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                  />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {title}
                </div>
                <div className="text-xs text-gray-500">Voice Recording</div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center space-x-2 flex-1 justify-center max-w-md">
              {/* Play/Pause Button */}
              <button
                onClick={togglePlayPause}
                disabled={!audioUrl}
                className="text-sky-500 hover:text-sky-600 p-1"
              >
                {isPlaying ? (
                  <i className="ri-pause-line w-5 h-5"></i>
                ) : (
                  <i className="ri-play-fill w-5 h-5"></i>
                )}
              </button>

              {/* Progress Bar */}
              <div className="flex items-center space-x-2 flex-1">
                <span className="text-xs text-gray-500 w-10 text-right">
                  {formatTime(currentTime)}
                </span>
                <div
                  className="flex-1 h-1 bg-gray-200 rounded-full cursor-pointer relative"
                  onClick={handleSeek}
                >
                  <div
                    className="h-full bg-sky-500 rounded-full relative"
                    style={{ width: `${progress}%` }}
                  >
                    <div className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-sky-500 rounded-full shadow hover:bg-sky-600 transition-colors"></div>
                  </div>
                </div>
                <span className="text-xs text-gray-500 w-10">
                  {formatTime(duration)}
                </span>
              </div>
            </div>

            {/* Volume and Close */}
            <div className="flex items-center space-x-4 flex-1 justify-end">
              {/* Volume Control */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={toggleMute}
                  className="text-gray-500 hover:text-gray-700"
                >
                  {isMuted || volume === 0 ? (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                      />
                    </svg>
                  ) : volume < 0.5 ? (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                      />
                    </svg>
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="w-20 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          box-shadow: 0 0 2px rgba(0, 0, 0, 0.3);
        }
        .slider::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: none;
          box-shadow: 0 0 2px rgba(0, 0, 0, 0.3);
        }
      `}</style>
    </>
  );
};

export default AudioPlayer;
