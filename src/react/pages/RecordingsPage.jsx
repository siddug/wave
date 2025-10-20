import React, { useState, useEffect } from "react";
import Button from "../components/Button";
import AudioPlayer from "../components/AudioPlayer";
import RecordingItem from "../components/RecordingItem";
import toast from "react-hot-toast";

const RecordingsPage = () => {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const RECORDINGS_PER_PAGE = 15;

  useEffect(() => {
    loadRecordings();

    // Listen for new recordings - use the new event
    const unsubscribe = window.electronAPI?.recording?.onRecordingComplete(
      (data) => {
        console.log("[RECORDINGS PAGE] New recording complete:", data);
        if (data.success && data.recording) {
          // Add new recording to the list in real-time
          setRecordings((prev) => [
            {
              id: data.recording.id,
              text: data.recording.text,
              originalText: data.recording.originalText,
              enhancedText: data.recording.enhancedText,
              timestamp: new Date(data.recording.createdAt).getTime(),
              language: "auto",
              duration: data.recording.duration,
              audioPath: data.recording.audioPath,
            },
            ...prev,
          ]);
          toast.success("New recording transcribed!");
        }
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const loadRecordings = async (page = currentPage) => {
    try {
      setLoading(true);
      console.log(
        "loadRecordings called with page:",
        page,
        "current page:",
        currentPage
      );
      const result = await window.electronAPI?.recording?.getRecordings({
        page: page,
        limit: RECORDINGS_PER_PAGE,
      });
      console.log("loadRecordings result:", result);

      if (result?.success) {
        // Transform the data to match our UI format
        const transformedRecordings = result.recordings.map((recording) => ({
          id: recording.id,
          text: recording.text || "Processing...",
          originalText: recording.originalText,
          enhancedText: recording.enhancedText,
          timestamp: new Date(recording.createdAt).getTime(),
          language: "auto",
          duration: recording.duration,
          audioPath: recording.audioPath,
        }));

        setRecordings(transformedRecordings);
        setTotalPages(result.totalPages);
        setTotalCount(result.totalCount);
        setHasMore(result.hasMore);
        setCurrentPage(result.currentPage);
      }
    } catch (error) {
      toast.error("Failed to load recordings");
      console.error("Failed to load recordings:", error);
    } finally {
      setLoading(false);
    }
  };

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

  const handlePlay = (recording) => {
    // Show the Spotify-style player
    setCurrentPlayer({
      audioPath: recording.audioPath,
      title: `Recording - ${formatTimeAgo(recording.timestamp)}`,
      recording: recording,
    });
  };

  const handleDelete = async (recording) => {
    try {
      await window.electronAPI?.recording?.deleteRecording(recording.id);
      await loadRecordings(currentPage); // Reload the current page
      toast.success("Recording deleted");
    } catch (error) {
      toast.error("Failed to delete recording");
    }
  };

  const handlePageChange = (newPage) => {
    console.log("CHECK", newPage);
    if (newPage >= 0 && newPage < totalPages) {
      setCurrentPage(newPage);
      setTimeout(() => loadRecordings(newPage), 200);
    }
  };

  return (
    <div className={`space-y-6 p-6 ${currentPlayer ? "pb-24" : ""}`}>
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-semibold text-gray-900">
            All Recordings
          </h1>
        </div>
        <p className="text-gray-600">
          Your recordings appear here. You can replay them or move them to a
          note to work on them separately.
        </p>
      </div>

      {/* Recordings List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading recordings...</p>
        </div>
      ) : (
        <div>
          <div className="space-y-4">
            {recordings.map((recording) => (
              <RecordingItem
                key={recording.id}
                recording={recording}
                showActions={true}
                onPlay={handlePlay}
                onDelete={handleDelete}
              />
            ))}
          </div>

          {totalPages > 1 && !loading && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-500">
                Showing {currentPage * RECORDINGS_PER_PAGE + 1} to{" "}
                {Math.min((currentPage + 1) * RECORDINGS_PER_PAGE, totalCount)}{" "}
                of {totalCount} recordings
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 0}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>

                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i;
                    } else if (currentPage < 3) {
                      pageNum = i;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 5 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`px-3 py-1 text-sm rounded-md ${
                          pageNum === currentPage
                            ? "bg-sky-500 text-white"
                            : "text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        {pageNum + 1}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages - 1}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state if no recordings */}
      {recordings.length === 0 && !loading && (
        <div className="text-center py-12">
          <svg
            className="w-16 h-16 text-gray-300 mx-auto mb-4"
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
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No recordings found
          </h3>
          <p className="text-gray-600 mb-6">
            Start recording to see your transcriptions here
          </p>

          <div className="bg-sky-50 rounded-lg p-4 text-left max-w-md mx-auto">
            <h4 className="font-medium text-sky-900 mb-2">Start Recording</h4>
            <div className="text-sm text-sky-800 space-y-1">
              <div>
                🌐 <strong>Hold Globe/Fn:</strong> Press and hold to record
              </div>
              <div>
                ⌨️ <strong>Ctrl + Space:</strong> Toggle recording on/off
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audio Player */}
      {currentPlayer && (
        <AudioPlayer
          audioPath={currentPlayer.audioPath}
          title={currentPlayer.title}
          onClose={() => setCurrentPlayer(null)}
        />
      )}
    </div>
  );
};

export default RecordingsPage;
