import React, { useState } from "react";
import toast from "react-hot-toast";

const RecordingItem = ({ recording, showActions = true, onPlay, onDelete }) => {
  const [showOriginal, setShowOriginal] = useState(false);
  const formatTimeAgo = (timestamp) => {
    const now = Date.now();
    const diff = now - timestamp;

    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days > 0) {
      return `${days} day${days > 1 ? "s" : ""} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
    } else {
      return "Just now";
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds || seconds < 0) return "0:00";

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins === 0) {
      return `${secs.toString().padStart(2, "0")} seconds`;
    }
    return `${mins} mins ${secs.toString().padStart(2, "0")} seconds`;
  };

  const handlePlay = (recording) => {
    console.log("RecordingItem handlePlay called with:", recording);
    if (onPlay) {
      onPlay(recording);
    } else {
      console.warn("No onPlay handler provided to RecordingItem");
      toast.error("Play function not available");
    }
  };

  const handleSelect = (recording) => {
    // Copy to clipboard - exactly like RecordingsPage
    navigator.clipboard
      .writeText(recording.text)
      .then(() => {
        toast.success("Recording text copied to clipboard");
      })
      .catch(() => {
        toast.error("Failed to copy to clipboard");
      });
  };

  const handleDelete = async (recording) => {
    if (onDelete) {
      // Use custom delete handler if provided
      onDelete(recording);
    } else {
      // Default delete behavior
      try {
        await window.electronAPI?.recording?.deleteRecording(recording.id);
        toast.success("Recording deleted");
      } catch (error) {
        toast.error("Failed to delete recording");
      }
    }
  };

  if (!recording) {
    return null;
  }

  // Determine which text to display
  const hasMultipleVersions = recording.originalText && recording.enhancedText && recording.originalText !== recording.enhancedText;
  const displayText = showOriginal ? (recording.originalText || recording.text) : (recording.text || recording.enhancedText);

  return (
    <div className="border-2 border-gray-50 rounded-lg p-4 bg-gray-50 font-medium transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Recording Text */}
          <p className="text-gray-900 mb-1 text-sm leading-relaxed" style={{
            whiteSpace: "break-spaceOriginals"
          }}>
            {displayText}
          </p>

          {/* Metadata */}
          <div className="text-xs space-x-2 text-gray-500 mb-0">
            <span>
              {formatTimeAgo(
                recording.timestamp || new Date(recording.createdAt).getTime()
              )}
            </span>
            {!!recording.duration ? (
              <span className="">/ {formatDuration(recording.duration)}</span>
            ) : null}
            {hasMultipleVersions && (
              <button
                onClick={() => setShowOriginal(!showOriginal)}
                className="ml-3 px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded hover:bg-blue-100 transition-colors"
                title={showOriginal ? "Show enhanced version" : "Show original version"}
              >
                {showOriginal ? "Show enchanced version" : "Show original version"}
              </button>
            )}
            {recording.language && recording.language !== "auto" && (
              <span className="ml-3 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                {recording.language.toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {/* Action Icons */}
        {showActions && (
          <div className="flex items-center gap-2 ml-6">
            <button
              onClick={() => handlePlay(recording)}
              className="p-2 text-gray-400 hover:text-sky-500 transition-colors"
              title="Play recording"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
            <button
              onClick={() => handleSelect(recording)}
              className="p-2 text-gray-400 hover:text-sky-500 transition-colors"
              title="Copy text"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </button>
            <button
              onClick={() => handleDelete(recording)}
              className={`p-2 text-gray-400 hover:text-red-500 transition-colors ${
                onDelete ? "" : "hidden"
              }`}
              title="Delete recording"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecordingItem;
