import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../components/Button";
import RecordingItem from "../components/RecordingItem";
import { useRecording } from "../hooks/useRecording";
import toast from "react-hot-toast";

const DashboardPage = () => {
  const { isRecording, isTranscribing, toggleRecording } = useRecording();
  const [recentRecordings, setRecentRecordings] = useState([]);
  const [permissions, setPermissions] = useState({
    accessibility: false,
    microphone: false,
  });
  const [stats, setStats] = useState({
    totalTimeSpokenWeek: 0,
    totalTimeTypedWeek: 0,
    totalRecordings: 0,
    totalWordsLastWeek: 0,
    avgWordsPerRecording: 0,
    avgWordsPerMinute: 0,
  });
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    loadRecentRecordings();
    loadDashboardStats();
    loadChartData();
    checkPermissions();

    // Listen for new recordings to update dashboard in real-time
    const unsubscribeRecording = window.electronAPI?.recording?.onRecordingComplete((data) => {
      console.log("[DASHBOARD] New recording completed, refreshing data...");
      if (data.success && data.recording) {
        // Refresh all dashboard data
        loadRecentRecordings();
        loadDashboardStats();
        loadChartData();
      }
    });

    // Listen for permission changes from main process
    const unsubscribePermissions = window.electronAPI?.permissions?.onPermissionsChanged((permissionState) => {
      console.log("[DASHBOARD] Permission state changed:", permissionState);
      setPermissions(permissionState);
    });

    return () => {
      if (unsubscribeRecording) unsubscribeRecording();
      if (unsubscribePermissions) unsubscribePermissions();
    };
  }, []);

  const loadRecentRecordings = async () => {
    try {
      const result = await window.electronAPI?.recording?.getRecordings({
        page: 0,
        limit: 3,
      });

      if (result?.success && result.recordings) {
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
        setRecentRecordings(transformedRecordings);
      }
    } catch (error) {
      console.error("Failed to load recent recordings:", error);
    }
  };

  const loadDashboardStats = async () => {
    try {
      // Get all recordings to calculate stats
      const result = await window.electronAPI?.recording?.getRecordings({
        page: 0,
        limit: 1000, // Get all recordings
      });

      if (result?.success && result.recordings) {
        const recordings = result.recordings;
        const now = Date.now();
        const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

        // Filter recordings from last week
        const lastWeekRecordings = recordings.filter(
          (r) => new Date(r.createdAt).getTime() >= oneWeekAgo
        );

        // Calculate stats
        const totalDurationSeconds = lastWeekRecordings.reduce(
          (sum, r) => sum + (r.duration || 0),
          0
        );
        const totalTimeSpokenWeek = totalDurationSeconds / 60; // minutes
        const totalTimeTypedWeek = totalTimeSpokenWeek * 3; // typing is 3x faster

        const totalWords = lastWeekRecordings.reduce((sum, r) => {
          const words = (r.text || "")
            .split(/\s+/)
            .filter((w) => w.length > 0).length;
          return sum + words;
        }, 0);

        const avgWordsPerRecording =
          lastWeekRecordings.length > 0
            ? Math.round(totalWords / lastWeekRecordings.length)
            : 0;
        const avgWordsPerMinute =
          totalTimeSpokenWeek > 0
            ? Math.round(totalWords / totalTimeSpokenWeek)
            : 0;

        setStats({
          totalTimeSpokenWeek: Math.round(totalTimeSpokenWeek * 10) / 10, // round to 1 decimal
          totalTimeTypedWeek: Math.round(totalTimeTypedWeek * 10) / 10,
          totalRecordings: recordings.length,
          totalWordsLastWeek: totalWords,
          avgWordsPerRecording,
          avgWordsPerMinute,
        });
      }
    } catch (error) {
      console.error("Failed to load dashboard stats:", error);
    }
  };

  const loadChartData = async () => {
    try {
      // Get all recordings to calculate chart data
      const result = await window.electronAPI?.recording?.getRecordings({
        page: 0,
        limit: 1000, // Get all recordings
      });

      if (result?.success && result.recordings) {
        const recordings = result.recordings;
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);

        // Find the earliest recording date, but limit to 30 days ago
        let startDate = thirtyDaysAgo;
        if (recordings.length > 0) {
          const earliestRecording = new Date(Math.min(...recordings.map(r => new Date(r.createdAt).getTime())));
          if (earliestRecording > thirtyDaysAgo) {
            startDate = earliestRecording;
          }
        }

        // Generate daily data from start date to today
        const chartData = [];
        const currentDate = new Date(startDate);
        
        while (currentDate <= today) {
          const dateStr = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD
          const recordingsOnDate = recordings.filter(r => {
            const recordingDate = new Date(r.createdAt).toISOString().split('T')[0];
            return recordingDate === dateStr;
          }).length;

          chartData.push({
            date: new Date(currentDate),
            recordings: recordingsOnDate,
            dateStr: dateStr
          });

          currentDate.setDate(currentDate.getDate() + 1);
        }

        setChartData(chartData);
      }
    } catch (error) {
      console.error("Failed to load chart data:", error);
    }
  };

  const checkPermissions = async () => {
    try {
      const accessibilityResult = await window.electronAPI?.permissions?.checkAccessibility();
      const microphoneResult = await window.electronAPI?.permissions?.checkMicrophone();

      setPermissions({
        accessibility: accessibilityResult?.granted || false,
        microphone: microphoneResult?.granted || false,
      });
    } catch (error) {
      console.error("Failed to check permissions:", error);
    }
  };

  const requestAccessibilityPermission = async () => {
    try {
      await window.electronAPI?.permissions?.openAccessibilitySettings();
      toast.success("Please grant accessibility permissions in System Preferences");

      // Check again after a delay
      setTimeout(() => {
        checkPermissions();
      }, 2000);
    } catch (error) {
      toast.error("Failed to open accessibility settings");
    }
  };

  const requestMicrophonePermission = async () => {
    try {
      // First check if permission is already granted
      const checkResult = await window.electronAPI.permissions.checkMicrophone();
      if (checkResult.granted) {
        setPermissions((prev) => ({ ...prev, microphone: true }));
        toast.success("Microphone permission already granted!");
        return;
      }

      const result = await window.electronAPI.permissions.requestMicrophone();

      // Open microphone settings
      toast("Opening Privacy Settings. Please enable microphone access for Wave.");
      await window.electronAPI.permissions.openMicrophoneSettings();
      
      // Check again after a delay to see if user granted permission
      setTimeout(async () => {
        const recheckResult = await window.electronAPI.permissions.checkMicrophone();
        if (recheckResult.granted) {
          setPermissions((prev) => ({ ...prev, microphone: true }));
          toast.success("Microphone permission granted!");
        }
      }, 2000);
      
    } catch (error) {
      console.error("Microphone permission error:", error);
      toast.error("Please enable microphone access in System Preferences");
    }
  };

  const handleQuickRecord = async () => {
    try {
      // Check permissions first
      if (!permissions.accessibility || !permissions.microphone) {
        toast.error("Please grant all required permissions to start recording");
        return;
      }
      
      await toggleRecording();
      if (!isRecording) {
        toast.success("Recording started - use keyboard shortcuts to stop");
      } else {
        toast.success("Recording stopped");
      }
    } catch (error) {
      toast.error("Failed to start recording");
      console.error("Recording error:", error);
    }
  };

  // Simple line chart component
  const LineChart = ({ data, height = 200 }) => {
    if (!data || data.length === 0) {
      return (
        <div className="flex items-center justify-center h-48 text-gray-500">
          No data to display
        </div>
      );
    }

    const maxRecordings = Math.max(...data.map(d => d.recordings), 1); // Ensure at least 1 for scaling
    const padding = 40;
    
    return (
      <div className="w-full bg-white rounded-lg p-4">
        <svg viewBox={`0 0 800 ${height}`} className="w-full h-auto overflow-visible">
          {(() => {
            const width = 800; // Fixed viewBox width for consistent scaling
            const chartWidth = width - padding * 2;
            const chartHeight = height - padding * 2;

            const points = data.map((d, i) => {
              const x = data.length === 1 ? padding + chartWidth / 2 : padding + (i / (data.length - 1)) * chartWidth;
              const y = padding + chartHeight - (d.recordings / maxRecordings) * chartHeight;
              return `${x},${y}`;
            }).join(' ');

            return (
              <>
                {/* Grid lines */}
                {[0, 1, 2, 3, 4, 5].map((line) => {
                  const y = padding + (line / 5) * chartHeight;
                  return (
                    <line
                      key={line}
                      x1={padding}
                      y1={y}
                      x2={width - padding}
                      y2={y}
                      stroke="#f3f4f6"
                      strokeWidth={1}
                    />
                  );
                })}

                {/* Y-axis labels */}
                {[0, 1, 2, 3, 4, 5].map((line) => {
                  const y = padding + chartHeight - (line / 5) * chartHeight;
                  const value = Math.round((line / 5) * maxRecordings);
                  return (
                    <text
                      key={line}
                      x={padding - 10}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-gray-500 text-xs"
                    >
                      {value}
                    </text>
                  );
                })}

                {/* Line */}
                <polyline
                  points={points}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  className="drop-shadow-sm"
                />

                {/* Dots */}
                {data.map((d, i) => {
                  const x = data.length === 1 ? padding + chartWidth / 2 : padding + (i / (data.length - 1)) * chartWidth;
                  const y = padding + chartHeight - (d.recordings / maxRecordings) * chartHeight;
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r={3}
                      fill="#3b82f6"
                      className="hover:r-4 cursor-pointer"
                    >
                      <title>{`${d.date.toLocaleDateString()}: ${d.recordings} recordings`}</title>
                    </circle>
                  );
                })}

                {/* X-axis labels (show every 5th day to avoid crowding) */}
                {data.map((d, i) => {
                  if (i % 5 === 0 || i === data.length - 1) {
                    const x = data.length === 1 ? padding + chartWidth / 2 : padding + (i / (data.length - 1)) * chartWidth;
                    return (
                      <text
                        key={i}
                        x={x}
                        y={height - 10}
                        textAnchor="middle"
                        className="fill-gray-500 text-xs"
                      >
                        {d.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </text>
                    );
                  }
                  return null;
                })}
              </>
            );
          })()}
        </svg>
      </div>
    );
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-sm text-gray-600">
          Voice transcription at your fingertips
        </p>
      </div>

      {/* Recording Status Card */}
      <div className="bg-gray-50 rounded-lg border border-gray-50 p-4">
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          Recording Status
        </h2>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className={`w-3 h-3 rounded-full ${
                isRecording
                  ? "bg-red-500 animate-pulse"
                  : isTranscribing
                  ? "bg-sky-500 animate-ping"
                  : "bg-green-500"
              }`}
            ></div>
            <span className="text-sm text-gray-700">
              {isRecording
                ? "Recording active..."
                : isTranscribing
                ? "Processing audio..."
                : "Ready to record"}
            </span>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={handleQuickRecord}
            disabled={isTranscribing || !permissions.accessibility || !permissions.microphone}
          >
            {isRecording ? "Stop recording" : "Quick Record"}
          </Button>
        </div>

        {/* Permission buttons when missing */}
        {(!permissions.accessibility || !permissions.microphone) && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-3">Permissions needed to start recording:</p>
            <div className="flex flex-wrap gap-2">
              {!permissions.accessibility && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={requestAccessibilityPermission}
                >
                  Grant Accessibility Access
                </Button>
              )}
              {!permissions.microphone && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={requestMicrophonePermission}
                >
                  Grant Microphone Access
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Shortcuts Info */}
      <div className="bg-sky-50 rounded-lg border border-sky-200 p-6">
        <h2 className="text-lg font-medium text-sky-900 mb-4">
          Keyboard Shortcuts
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <kbd className="px-2 py-1 bg-white border border-sky-300 rounded text-xs font-mono">
                Globe/Fn
              </kbd>
              <span className="text-sky-800">Hold to record</span>
            </div>
            <p className="text-sky-600 text-xs">
              Press and hold, release to stop
            </p>
          </div>
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <kbd className="px-2 py-1 bg-white border border-sky-300 rounded text-xs font-mono">
                Ctrl
              </kbd>
              <kbd className="px-2 py-1 bg-white border border-sky-300 rounded text-xs font-mono">
                Space
              </kbd>
              <span className="text-sky-800">Toggle recording</span>
            </div>
            <p className="text-sky-600 text-xs">
              Press once to start, again to stop
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/recordings">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-sky-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-sky-600"
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
              <div>
                <h3 className="font-medium text-gray-900">Recordings</h3>
                <p className="text-sm text-gray-500">View all recordings</p>
              </div>
            </div>
          </div>
        </Link>

        <Link to="/models">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Models</h3>
                <p className="text-sm text-gray-500">Manage AI models</p>
              </div>
            </div>
          </div>
        </Link>

        <Link to="/settings">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Settings</h3>
                <p className="text-sm text-gray-500">Configure shortcuts</p>
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Stats Set 1 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {stats.totalTimeSpokenWeek}m
              </p>
              <p className="text-sm text-gray-500">Time spoken this week</p>
            </div>
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg
                className="w-5 h-5 text-blue-600"
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
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {stats.totalTimeTypedWeek}m
              </p>
              <p className="text-sm text-gray-500">Time typed this week</p>
            </div>
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg
                className="w-5 h-5 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {stats.totalRecordings}
              </p>
              <p className="text-sm text-gray-500">Total recordings</p>
            </div>
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg
                className="w-5 h-5 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Set 2 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {stats.totalWordsLastWeek.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500">Words captured last week</p>
            </div>
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <svg
                className="w-5 h-5 text-yellow-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {stats.avgWordsPerRecording}
              </p>
              <p className="text-sm text-gray-500">Words per recording</p>
            </div>
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <svg
                className="w-5 h-5 text-indigo-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {stats.avgWordsPerMinute}
              </p>
              <p className="text-sm text-gray-500">Words per minute</p>
            </div>
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <svg
                className="w-5 h-5 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Recordings Chart */}
      <div className="bg-gray-50 rounded-lg border border-gray-50 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Daily Recordings</h2>
          <p className="text-sm text-gray-500">
            {chartData.length > 0 && (
              <>Last {chartData.length} days</>
            )}
          </p>
        </div>
        
        <LineChart 
          data={chartData} 
          height={250} 
        />
      </div>

      {/* Recent Recordings */}
      <div className="bg-gray-50 rounded-lg border border-gray-50 bg-gray-50 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">
            Recent Recordings
          </h2>
          <Link to="/recordings">
            <Button variant="ghost" size="sm">
              View All
            </Button>
          </Link>
        </div>

        {recentRecordings.length === 0 ? (
          <div className="text-center py-8">
            <svg
              className="w-12 h-12 text-gray-300 mx-auto mb-4"
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
            <p className="text-gray-500 text-sm">No recordings yet</p>
            <p className="text-gray-400 text-sm">
              Start recording to see your transcriptions here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentRecordings.map((recording) => (
              <RecordingItem
                key={recording.id}
                recording={recording}
                showActions={false}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
