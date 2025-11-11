import React, { useState, useEffect } from "react";
import Button from "../components/Button";
import ModelCard from "../components/ModelCard";
import RecordingItem from "../components/RecordingItem";
import AudioPlayer from "../components/AudioPlayer";
import toast from "react-hot-toast";
import { DEFAULT_SETTINGS, getShortcutToLabel } from "../utils/constants";

const SetupPage = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  
  // Permissions state - managed separately and consistently
  const [accessibilityGranted, setAccessibilityGranted] = useState(false);
  const [microphoneGranted, setMicrophoneGranted] = useState(false);
  
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [selectedModel, setSelectedModel] = useState("");
  const [modelStatus, setModelStatus] = useState({});
  const [downloadingModel, setDownloadingModel] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState({});
  const [selectedLLMModel, setSelectedLLMModel] = useState("");
  const [llmModelStatus, setLLMModelStatus] = useState({});
  const [downloadingLLMModels, setDownloadingLLMModels] = useState(new Set());
  const [llmDownloadProgress, setLLMDownloadProgress] = useState({});
  const [tutorialRecordings, setTutorialRecordings] = useState({});
  const [tutorialStepStartTimes, setTutorialStepStartTimes] = useState({});
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [currentSettings, setCurrentSettings] = useState(DEFAULT_SETTINGS);

  // Load initial settings
  const loadSettings = async () => {
    try {
      const result = await window.electronAPI?.store?.get("appSettings");
      if (result) {
        setCurrentSettings({ ...DEFAULT_SETTINGS, ...result });
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  };

  // Setup permissions monitoring - completely separate from models
  useEffect(() => {
    const initializePermissions = async () => {
      try {
        // Check initial permissions
        const accessResult = await window.electronAPI?.permissions?.checkAccessibility();
        setAccessibilityGranted(accessResult?.granted || false);

        const micResult = await window.electronAPI?.permissions?.checkMicrophone();
        setMicrophoneGranted(micResult?.granted || false);
      } catch (error) {
        console.error("Failed to check initial permissions:", error);
      }
    };

    // Subscribe to permission changes
    const unsubscribePermissions = window.electronAPI?.permissions?.onPermissionsChanged?.(
      (permissionState) => {
        console.log("[SETUP] Permission state changed:", permissionState);
        setAccessibilityGranted(permissionState.accessibility);
        setMicrophoneGranted(permissionState.microphone);
      }
    );

    initializePermissions();

    return () => {
      if (unsubscribePermissions) unsubscribePermissions();
    };
  }, []); // Only run once on mount

  // Load other data on mount
  useEffect(() => {
    loadSettings();
    loadModelStatus();
    loadLLMModelStatus();
    setupModelListeners();
  }, []);

  // Setup recording listener - recreate when currentStep or tutorialStepStartTimes changes
  useEffect(() => {
    const cleanup = setupRecordingListener();
    return cleanup;
  }, [currentStep, tutorialStepStartTimes]);

  const loadModelStatus = async () => {
    try {
      const status = await window.electronAPI?.models?.getStatus();
      setModelStatus(status || {});

      const selectedId = Object.keys(status || {}).find(
        (id) => status[id]?.selected
      );
      if (selectedId) {
        setSelectedModel(selectedId);
      }
    } catch (error) {
      console.error("Failed to load model status:", error);
    }
  };

  const loadLLMModelStatus = async () => {
    try {
      const statusResult = await window.electronAPI?.llm?.getStatus();
      const status = statusResult?.status || {};
      setLLMModelStatus(status);

      const selectedModelId = Object.keys(status).find(
        (id) => status[id]?.selected
      );
      if (selectedModelId) {
        setSelectedLLMModel(selectedModelId);
      }
    } catch (error) {
      console.error("Failed to load LLM model status:", error);
    }
  };

  const setupModelListeners = () => {
    // Whisper model listeners
    const unsubscribeProgress = window.electronAPI?.models?.onDownloadProgress(
      (data) => {
        setDownloadProgress((prev) => ({
          ...prev,
          [data.modelId]: data.progress,
        }));
      }
    );

    const unsubscribeComplete = window.electronAPI?.models?.onDownloadComplete(
      (data) => {
        setDownloadingModel(null);
        setDownloadProgress((prev) => ({ ...prev, [data.modelId]: 100 }));

        if (data.success) {
          setModelStatus((prev) => ({
            ...prev,
            [data.modelId]: {
              downloaded: true,
              selected: data.autoSelected || false,
            },
          }));

          if (data.autoSelected) {
            setSelectedModel(data.modelId);
            toast.success(
              `${data.modelId} model downloaded and selected automatically!`
            );
          } else {
            toast.success(`${data.modelId} model downloaded successfully!`);
          }
        } else {
          toast.error("Failed to download model");
        }
      }
    );

    // LLM model listeners
    const unsubscribeLLMProgress = window.electronAPI?.llm?.onDownloadProgress(
      (data) => {
        setLLMDownloadProgress((prev) => ({
          ...prev,
          [data.modelId]: data.progress,
        }));
      }
    );

    const unsubscribeLLMComplete = window.electronAPI?.llm?.onDownloadComplete(
      (data) => {
        setDownloadingLLMModels((prev) => {
          const newSet = new Set(prev);
          newSet.delete(data.modelId);
          return newSet;
        });
        setLLMDownloadProgress((prev) => ({ ...prev, [data.modelId]: 100 }));

        if (data.success) {
          setLLMModelStatus((prev) => ({
            ...prev,
            [data.modelId]: {
              downloaded: true,
              selected: data.autoSelected || false,
            },
          }));

          if (data.autoSelected) {
            setSelectedLLMModel(data.modelId);
            toast.success(
              `${data.modelId} LLM model downloaded and selected automatically!`
            );
          } else {
            toast.success(`${data.modelId} LLM model downloaded successfully!`);
          }
        } else {
          toast.error("Failed to download LLM model");
        }
      }
    );

    return () => {
      if (unsubscribeProgress) unsubscribeProgress();
      if (unsubscribeComplete) unsubscribeComplete();
      if (unsubscribeLLMProgress) unsubscribeLLMProgress();
      if (unsubscribeLLMComplete) unsubscribeLLMComplete();
    };
  };

  const setupRecordingListener = () => {
    let unsubscribeRecording;

    if (window.electronAPI?.recording?.onRecordingComplete) {
      unsubscribeRecording = window.electronAPI.recording.onRecordingComplete(
        (data) => {
          if (
            data.success &&
            data.recording &&
            (currentStep === 6 || currentStep === 7)
          ) {
            const stepId = currentStep === 6 ? "tutorial1" : "tutorial2";
            const stepStartTime = tutorialStepStartTimes[stepId];

            const recordingTime =
              data.recording.timestamp ||
              new Date(data.recording.createdAt).getTime();
            
            if (stepStartTime && recordingTime >= stepStartTime) {
              setTutorialRecordings((prev) => ({
                ...prev,
                [stepId]: {
                  ...data.recording,
                  timestamp: recordingTime,
                },
              }));
              toast.success(
                "Great! Your tutorial recording has been captured."
              );
            }
          }
        }
      );
    }

    return () => {
      if (unsubscribeRecording) unsubscribeRecording();
    };
  };

  const langs = [
    { code: "en", name: "English", flag: "🇺🇸" },
    { code: "es", name: "Spanish", flag: "🇪🇸" },
    { code: "fr", name: "French", flag: "🇫🇷" },
    { code: "de", name: "German", flag: "🇩🇪" },
    { code: "it", name: "Italian", flag: "🇮🇹" },
  ];

  const llmSetupModels = [
    {
      id: "llama-3.1-8b-instruct-q4",
      name: "Meta Llama 3.1 8B Instruct (Q4_K_M)",
      language: "English",
      size: "4.9 GiB",
      speed: 7.5,
      accuracy: 9.2,
      description:
        "High-quality 8B parameter model, excellent balance of performance and speed for various tasks.",
      recommended: false,
      tags: ["instruction-following", "chat", "reasoning"],
    },
    {
      id: "gemma-3-1b-it-Q8_0",
      name: "Google Gemma 3 1B Instruct (Q8_0)",
      language: "English",
      size: "1.0 GiB",
      speed: 9.5,
      accuracy: 8.0,
      description:
        "Compact yet capable model from Google, excellent for fast inference with good quality.",
      recommended: true,
      tags: ["fast", "efficient", "chat", "instruction-following"],
    },
    {
      "id": "gemma-3n-E4B-it-Q4_0.gguf",
      name: "Google Gemma 3N E4B Instruct (Q4_0)",
      language: "English",
      size: "4.0 GiB",
      speed: 8,
      accuracy: 9.0,
      description:
        "E4B model from Google, excellent for fast inference with good quality.",
      recommended: false,
      tags: ["fast", "efficient", "chat", "instruction-following"],
    }
  ];

  const setupModels = [
    {
      id: "tiny",
      name: "Whisper Tiny",
      language: "Multilingual",
      size: "0.1 GiB",
      speed: 9.0,
      accuracy: 6.0,
      description:
        "Tiny model: fastest, lowest accuracy. Good for quick tests or low-resource devices.",
      recommended: false,
    },
    {
      id: "base",
      name: "Whisper Base",
      language: "Multilingual",
      size: "0.1 GiB",
      speed: 8.0,
      accuracy: 7.0,
      description: "Base model: balance of speed and accuracy for general use.",
      recommended: false,
    },
    {
      id: "small",
      name: "Whisper Small",
      language: "Multilingual",
      size: "0.5 GiB",
      speed: 7.0,
      accuracy: 8.0,
      description: "Small model: slower, but more accurate than base.",
      recommended: true,
    },
    {
      id: "medium",
      name: "Whisper Medium",
      language: "Multilingual",
      size: "1.5 GiB",
      speed: 6.5,
      accuracy: 9.0,
      description:
        "Medium model: high accuracy, slower speed. Good for high-quality transcriptions.",
      recommended: false,
    },
    {
      id: "large-v3-turbo",
      name: "Whisper Large V3 Turbo",
      language: "Multilingual",
      size: "2.8 GiB",
      speed: 6,
      accuracy: 9.7,
      description:
        "Large model v3 Turbo, faster than v3 with similar accuracy.",
      recommended: false,
    },
  ];

  const toCamelCase = (str) => {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  // Permission request handlers - clean and simple
  const requestAccessibilityPermission = async () => {
    try {
      if (accessibilityGranted) {
        toast.success("Accessibility permission already granted!");
        return;
      }

      await window.electronAPI?.permissions?.openAccessibilitySettings();
      toast.success(
        "Please grant accessibility permissions in System Preferences"
      );
    } catch (error) {
      toast.error("Failed to request accessibility permissions");
    }
  };

  const requestMicrophonePermission = async () => {
    try {
      if (microphoneGranted) {
        toast.success("Microphone permission already granted!");
        return;
      }

      // Open microphone settings
      await window.electronAPI?.permissions?.openMicrophoneSettings();
      toast("Opening Privacy Settings. Please enable microphone access for Wave.");

      // Request permission
      await window.electronAPI?.permissions?.requestMicrophone();
    } catch (error) {
      console.error("Microphone permission error:", error);
      toast.error("Please enable microphone access in System Preferences");
    }
  };

  // Model management functions
  const handleDownloadModel = async (modelId) => {
    try {
      setDownloadingModel(modelId);
      setDownloadProgress((prev) => ({ ...prev, [modelId]: 0 }));

      const result = await window.electronAPI?.models?.download(modelId);
      if (!result?.success) {
        toast.error("Failed to start model download");
        setDownloadingModel(null);
      }
    } catch (error) {
      toast.error("Failed to download model");
      setDownloadingModel(null);
    }
  };

  const handleSelectModel = async (modelId) => {
    try {
      const result = await window.electronAPI?.models?.select(modelId);
      if (result?.success) {
        setSelectedModel(modelId);
        setModelStatus((prev) => {
          const updated = { ...prev };
          Object.keys(updated).forEach((id) => {
            if (updated[id]) updated[id].selected = false;
          });
          if (updated[modelId]) updated[modelId].selected = true;
          return updated;
        });
        toast.success(`${modelId} model selected`);
      } else {
        toast.error(result?.error || "Failed to select model");
      }
    } catch (error) {
      toast.error("Failed to select model");
    }
  };

  const handleDeleteModel = async (modelId) => {
    try {
      const result = await window.electronAPI?.models?.delete(modelId);
      if (result?.success) {
        await loadModelStatus();
        toast.success(`${modelId} model deleted`);
      } else {
        toast.error(result?.error || "Failed to delete model");
      }
    } catch (error) {
      toast.error("Failed to delete model");
    }
  };

  const handleDownloadLLMModel = async (modelId) => {
    if (downloadingLLMModels.has(modelId)) {
      return;
    }

    try {
      setDownloadingLLMModels((prev) => new Set([...prev, modelId]));
      setLLMDownloadProgress((prev) => ({ ...prev, [modelId]: 0 }));

      const result = await window.electronAPI?.llm?.download(modelId);
      if (!result?.success) {
        toast.error(result?.error || "Failed to start LLM model download");
        setDownloadingLLMModels((prev) => {
          const newSet = new Set(prev);
          newSet.delete(modelId);
          return newSet;
        });
      }
    } catch (error) {
      toast.error("Failed to download LLM model");
      setDownloadingLLMModels((prev) => {
        const newSet = new Set(prev);
        newSet.delete(modelId);
        return newSet;
      });
    }
  };

  const handleSelectLLMModel = async (modelId) => {
    try {
      const result = await window.electronAPI?.llm?.select(modelId);
      if (result?.success) {
        setSelectedLLMModel(modelId);
        setLLMModelStatus((prev) => {
          const updated = { ...prev };
          Object.keys(updated).forEach((id) => {
            if (updated[id]) updated[id].selected = false;
          });
          if (updated[modelId]) updated[modelId].selected = true;
          return updated;
        });
        toast.success(`${modelId} LLM model selected`);
      } else {
        toast.error(result?.error || "Failed to select LLM model");
      }
    } catch (error) {
      toast.error("Failed to select LLM model");
    }
  };

  const handleDeleteLLMModel = async (modelId) => {
    try {
      const result = await window.electronAPI?.llm?.delete(modelId);
      if (result?.success) {
        await loadLLMModelStatus();
        toast.success(`${modelId} LLM model deleted`);
      } else {
        toast.error(result?.error || "Failed to delete LLM model");
      }
    } catch (error) {
      toast.error("Failed to delete LLM model");
    }
  };

  // Audio playback
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
    if (!recording) {
      toast.error("No recording to play");
      return;
    }

    const timestamp =
      recording.timestamp ||
      (recording.createdAt
        ? new Date(recording.createdAt).getTime()
        : Date.now());

    setCurrentPlayer({
      audioPath: recording.audioPath,
      title: `Recording - ${formatTimeAgo(timestamp)}`,
      recording: recording,
    });
  };

  // Step definitions
  const steps = [
    {
      id: "welcome",
      title: "Welcome to Wave",
      description:
        "Let's get you set up with voice transcription in just a few steps.",
      content: (
        <div className="text-center py-xxxl">
          <div className="w-16 h-16 bg-info-light/10 dark:bg-info-dark/10 rounded-full flex items-center justify-center mx-auto mb-xl transition-colors duration-fast">
            <svg
              className="w-8 h-8 text-info-light dark:text-info-dark transition-colors duration-fast"
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
          <h3 className="text-lg font-medium text-text-primary-light dark:text-text-primary-dark mb-md transition-colors duration-fast">
            Ready to get started?
          </h3>
        </div>
      ),
    },
    {
      id: "accessibility",
      title: "Accessibility Permissions",
      description:
        "Accessibility permissions allow Wave to listen for global keyboard shortcuts even when the app isn't focused.",
      content: (
        <div className="py-xxxl">
          <div className="text-center">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-xl transition-colors duration-fast ${
                accessibilityGranted ? "bg-success-light/10 dark:bg-success-dark/10" : "bg-bg-surface-light dark:bg-bg-surface-dark"
              }`}
            >
              {accessibilityGranted ? (
                <svg
                  className="w-8 h-8 text-success-light dark:text-success-dark transition-colors duration-fast"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                <svg
                  className="w-8 h-8 text-text-secondary-light dark:text-text-secondary-dark transition-colors duration-fast"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m0 0v2m0-2h2m-2 0H8m13-9.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
                  />
                </svg>
              )}
            </div>
            <p className="text-lg font-medium text-text-primary-light dark:text-text-primary-dark transition-colors duration-fast">
              {accessibilityGranted
                ? "Accessibility permissions granted!"
                : "Accessibility permissions needed"}
            </p>
          </div>
        </div>
      ),
      onStepEnter: () => {
        if (!accessibilityGranted) {
          requestAccessibilityPermission();
        }
      },
    },
    {
      id: "microphone",
      title: "Microphone Permissions",
      description:
        "Wave needs microphone access to record your voice for transcription.",
      content: (
        <div className="py-xxxl">
          <div className="text-center">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-xl transition-colors duration-fast ${
                microphoneGranted ? "bg-success-light/10 dark:bg-success-dark/10" : "bg-bg-surface-light dark:bg-bg-surface-dark"
              }`}
            >
              {microphoneGranted ? (
                <svg
                  className="w-8 h-8 text-success-light dark:text-success-dark transition-colors duration-fast"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                <svg
                  className="w-8 h-8 text-text-secondary-light dark:text-text-secondary-dark transition-colors duration-fast"
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
              )}
            </div>
            <p className="text-lg font-medium text-text-primary-light dark:text-text-primary-dark transition-colors duration-fast">
              {microphoneGranted
                ? "Microphone access granted!"
                : "Microphone access needed"}
            </p>
          </div>
        </div>
      ),
      onStepEnter: () => {
        if (!microphoneGranted) {
          requestMicrophonePermission();
        }
      },
    },
    {
      id: "language",
      title: "Choose Language",
      description: "Select your preferred language for voice recognition.",
      content: (
        <div className="py-xxxl max-w-2xl mx-auto">
          <div className="space-y-lg">
            {langs.map((lang) => (
              <label
                key={lang.code}
                className={`flex items-center p-lg border bg-bg-surface-light dark:bg-bg-surface-dark border-2 transition-all duration-fast ${
                  selectedLanguage === lang.code
                    ? `border-primary-light dark:border-primary-dark`
                    : `border-border-light-light dark:border-border-light-dark`
                } rounded-lg cursor-pointer hover:border-border-medium-light dark:hover:border-border-medium-dark`}
              >
                <input
                  type="radio"
                  name="language"
                  value={lang.code}
                  checked={selectedLanguage === lang.code}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="mr-lg focus:outline-none"
                />
                <span className="text-lg mr-lg">{lang.flag}</span>
                <span className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark transition-colors duration-fast">
                  {lang.name}
                </span>
              </label>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "model",
      title: "Choose AI Model",
      description:
        "Select a voice recognition model. We recommend starting with Base.",
      content: (
        <div className="py-6">
          <div className="space-y-3">
            {setupModels.map((model) => {
              const isDownloaded = modelStatus[model.id]?.downloaded || false;
              const isSelected = modelStatus[model.id]?.selected || false;
              const isDownloading = downloadingModel === model.id;
              const progress = downloadProgress[model.id] || 0;

              const enhancedModel = {
                ...model,
                downloaded: isDownloaded,
                downloading: isDownloading,
                selected: isSelected,
                progress,
              };

              return (
                <ModelCard
                  key={model.id}
                  model={enhancedModel}
                  isSelected={isSelected}
                  isDownloading={isDownloading}
                  progress={progress}
                  onDownload={handleDownloadModel}
                  onSelect={handleSelectModel}
                  onDelete={handleDeleteModel}
                  showRadio={true}
                  radioName="model"
                  radioValue={selectedModel}
                  onRadioChange={() =>
                    isDownloaded && setSelectedModel(model.id)
                  }
                />
              );
            })}
          </div>
        </div>
      ),
    },
    {
      id: "llm-model",
      title: "Choose Language Model",
      description:
        "Select a language model for text generation and processing. We recommend starting with Llama 3.1 8B.",
      content: (
        <div className="py-6">
          <div className="space-y-3">
            {llmSetupModels.map((model) => {
              const isDownloaded =
                llmModelStatus[model.id]?.downloaded || false;
              const isSelected = llmModelStatus[model.id]?.selected || false;
              const isDownloading = downloadingLLMModels.has(model.id);
              const progress = llmDownloadProgress[model.id] || 0;

              const enhancedModel = {
                ...model,
                downloaded: isDownloaded,
                downloading: isDownloading,
                selected: isSelected,
                progress,
              };

              return (
                <ModelCard
                  key={model.id}
                  model={enhancedModel}
                  isSelected={isSelected}
                  isDownloading={isDownloading}
                  progress={progress}
                  onDownload={handleDownloadLLMModel}
                  onSelect={handleSelectLLMModel}
                  onDelete={handleDeleteLLMModel}
                  showRadio={true}
                  radioName="llm-model"
                  radioValue={selectedLLMModel}
                  onRadioChange={() =>
                    isDownloaded && setSelectedLLMModel(model.id)
                  }
                />
              );
            })}
          </div>
        </div>
      ),
    },
    {
      id: "tutorial1",
      title: "Tutorial: Hold to Record",
      description: "Practice using the hold-to-record shortcut (Globe/Fn key).",
      content: (
        <div className="py-xxxl">
          <div className="text-center bg-bg-surface-light dark:bg-bg-surface-dark rounded-lg p-xxxl mb-xxxl max-w-2xl mx-auto transition-colors duration-fast">
            <div className="w-16 h-16 bg-info-light/10 dark:bg-info-dark/10 rounded-full flex items-center justify-center mx-auto mb-xl transition-colors duration-fast">
              <kbd className="px-lg py-md text-text-primary-light dark:text-text-primary-dark bg-bg-primary-light dark:bg-bg-primary-dark border border-border-medium-light dark:border-border-medium-dark rounded text-sm font-mono transition-colors duration-fast">
                {getShortcutToLabel(currentSettings.holdShortcut.start)}
              </kbd>
            </div>
            <h3 className="font-medium text-text-primary-light dark:text-text-primary-dark mb-md transition-colors duration-fast">
              Hold the {getShortcutToLabel(currentSettings.holdShortcut.start)}{" "}
              key
            </h3>
            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark transition-colors duration-fast">
              Press and hold the{" "}
              {getShortcutToLabel(currentSettings.holdShortcut.start)} key to
              start recording. Release to stop and transcribe.
            </p>
          </div>

          {tutorialRecordings.tutorial1 ? (
            <div className="mt-lg max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-md">
                <div>
                  <span className="text-xs text-success-light dark:text-success-dark transition-colors duration-fast">
                    Tutorial complete
                  </span>
                </div>
                <button
                  onClick={() => {
                    setTutorialRecordings((prev) => ({
                      ...prev,
                      tutorial1: null,
                    }));
                    setTutorialStepStartTimes((prev) => ({
                      ...prev,
                      tutorial1: Date.now(),
                    }));
                    toast("Ready for another attempt. Try recording again!");
                  }}
                  className="text-xs ml-auto text-primary-light dark:text-primary-dark hover:text-primary-light/80 dark:hover:text-primary-dark/80 underline transition-colors duration-fast"
                >
                  Try Again
                </button>
              </div>
              <RecordingItem
                recording={tutorialRecordings.tutorial1}
                showActions={true}
                onPlay={handlePlay}
              />
            </div>
          ) : (
            <div className="mt-lg max-w-2xl mx-auto">
              <div className="text-sm text-text-tertiary-light dark:text-text-tertiary-dark italic"></div>
            </div>
          )}
        </div>
      ),
      onStepEnter: () => {
        setTutorialStepStartTimes((prev) => ({
          ...prev,
          tutorial1: Date.now(),
        }));
      },
    },
    {
      id: "tutorial2",
      title: "Tutorial: Toggle Recording",
      description: `Practice using the toggle recording shortcut (${getShortcutToLabel(
        currentSettings.toggleShortcut.start
      )}).`,
      content: (
        <div className="py-xxxl">
          <div className="text-center bg-bg-surface-light dark:bg-bg-surface-dark rounded-lg p-xxxl mb-xxxl max-w-2xl mx-auto transition-colors duration-fast">
            <div className="w-16 h-16 bg-info-light/10 dark:bg-info-dark/10 rounded-full flex items-center justify-center mx-auto mb-xl transition-colors duration-fast">
              <div className="flex items-center space-x-1">
                {getShortcutToLabel(currentSettings.toggleShortcut.start)
                  .split("+")
                  .map((key, index) => (
                    <React.Fragment key={index}>
                      {index > 0 && <span className="text-text-tertiary-light dark:text-text-tertiary-dark transition-colors duration-fast">+</span>}
                      <kbd className="px-md py-sm text-text-primary-light dark:text-text-primary-dark bg-bg-primary-light dark:bg-bg-primary-dark border border-border-medium-light dark:border-border-medium-dark rounded text-xs font-mono transition-colors duration-fast">
                        {key}
                      </kbd>
                    </React.Fragment>
                  ))}
              </div>
            </div>
            <h3 className="font-medium text-text-primary-light dark:text-text-primary-dark mb-md transition-colors duration-fast">
              Press {getShortcutToLabel(currentSettings.toggleShortcut.start)}
            </h3>
            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark transition-colors duration-fast">
              Press once to start recording, press again to stop and transcribe.
            </p>
          </div>

          {tutorialRecordings.tutorial2 ? (
            <div className="mt-lg max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-md">
                <div>
                  <span className="text-xs text-success-light dark:text-success-dark transition-colors duration-fast">
                    Tutorial complete
                  </span>
                </div>
                <button
                  onClick={() => {
                    setTutorialRecordings((prev) => ({
                      ...prev,
                      tutorial2: null,
                    }));
                    setTutorialStepStartTimes((prev) => ({
                      ...prev,
                      tutorial2: Date.now(),
                    }));
                    toast("Ready for another attempt. Try recording again!");
                  }}
                  className="text-xs ml-auto text-primary-light dark:text-primary-dark hover:text-primary-light/80 dark:hover:text-primary-dark/80 underline transition-colors duration-fast"
                >
                  Try Again
                </button>
              </div>
              <RecordingItem
                recording={tutorialRecordings.tutorial2}
                showActions={true}
                onPlay={handlePlay}
              />
            </div>
          ) : (
            <div className="mt-lg max-w-2xl mx-auto">
              <div className="text-sm text-text-tertiary-light dark:text-text-tertiary-dark italic"></div>
            </div>
          )}
        </div>
      ),
      onStepEnter: () => {
        setTutorialStepStartTimes((prev) => ({
          ...prev,
          tutorial2: Date.now(),
        }));
      },
    },
    {
      id: "complete",
      title: "All Set!",
      description:
        "Wave is now ready to transcribe your voice. Use the shortcuts you just learned to start recording.",
      content: (
        <div className="py-xxxl text-center">
          <div className="w-16 h-16 bg-success-light/10 dark:bg-success-dark/10 rounded-full flex items-center justify-center mx-auto mb-xl transition-colors duration-fast">
            <svg
              className="w-8 h-8 text-success-light dark:text-success-dark transition-colors duration-fast"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <div className="rounded-lg p-xl max-w-2xl mx-auto">
            <h4 className="font-medium text-text-primary-light dark:text-text-primary-dark mb-md transition-colors duration-fast">Quick Reminder</h4>
            <div className="text-sm text-text-body-light dark:text-text-body-dark space-y-sm transition-colors duration-fast">
              <div>
                <strong className="text-text-primary-light dark:text-text-primary-dark transition-colors duration-fast">
                  Hold {getShortcutToLabel(currentSettings.holdShortcut.start)}:
                </strong>{" "}
                Press and hold to record
              </div>
              <div>
                <strong className="text-text-primary-light dark:text-text-primary-dark transition-colors duration-fast">
                  {getShortcutToLabel(currentSettings.toggleShortcut.start)}:
                </strong>{" "}
                Toggle recording on/off
              </div>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const currentStepData = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  const canProceed = () => {
    switch (currentStepData.id) {
      case "accessibility":
        return accessibilityGranted;
      case "microphone":
        return microphoneGranted;
      case "model":
        return Object.keys(modelStatus).some((id) => modelStatus[id]?.selected);
      case "llm-model":
        return Object.keys(llmModelStatus).some(
          (id) => llmModelStatus[id]?.selected
        );
      case "tutorial1":
        return !!tutorialRecordings.tutorial1;
      case "tutorial2":
        return !!tutorialRecordings.tutorial2;
      default:
        return true;
    }
  };

  const handleNext = () => {
    // Handle step-specific actions
    switch (currentStepData.id) {
      case "welcome":
        setCompletedSteps((prev) => new Set([...prev, "welcome"]));
        break;
      case "accessibility":
        if (accessibilityGranted) {
          setCompletedSteps((prev) => new Set([...prev, "accessibility"]));
        }
        break;
      case "microphone":
        if (microphoneGranted) {
          setCompletedSteps((prev) => new Set([...prev, "microphone"]));
        }
        break;
      case "language":
        setCompletedSteps((prev) => new Set([...prev, "language"]));
        toast.success(
          `Language set to ${
            langs.filter((x) => x.code === selectedLanguage)[0].name
          }`
        );
        break;
      case "model":
        const hasSelectedModel = Object.keys(modelStatus).some(
          (id) => modelStatus[id]?.selected
        );
        if (!hasSelectedModel) {
          toast.error("Please download and select a model first");
          return;
        }
        setCompletedSteps((prev) => new Set([...prev, "model"]));
        const activeModel = Object.keys(modelStatus).find(
          (id) => modelStatus[id]?.selected
        );
        toast.success(`Selected ${toCamelCase(activeModel)} model`);
        break;
      case "llm-model":
        const hasSelectedLLMModel = Object.keys(llmModelStatus).some(
          (id) => llmModelStatus[id]?.selected
        );
        if (!hasSelectedLLMModel) {
          toast.error("Please download and select a language model first");
          return;
        }
        setCompletedSteps((prev) => new Set([...prev, "llm-model"]));
        const activeLLMModel = Object.keys(llmModelStatus).find(
          (id) => llmModelStatus[id]?.selected
        );
        toast.success(`Selected ${toCamelCase(activeLLMModel)} language model`);
        break;
      case "tutorial1":
        setCompletedSteps((prev) => new Set([...prev, "tutorial1"]));
        toast.success("Tutorial 1 completed!");
        break;
      case "tutorial2":
        setCompletedSteps((prev) => new Set([...prev, "tutorial2"]));
        toast.success("Tutorial 2 completed!");
        break;
      case "complete":
        handleSetupComplete();
        return;
    }

    // Navigate to next step
    const nextStepIndex = currentStep + 1;
    if (nextStepIndex < steps.length) {
      setCurrentStep(nextStepIndex);
      const nextStep = steps[nextStepIndex];
      if (nextStep?.onStepEnter) {
        setTimeout(() => {
          nextStep.onStepEnter();
        }, 100);
      }
    }
  };

  const handleSetupComplete = async () => {
    try {
      await window.electronAPI?.setup?.complete();
      toast.success("Setup complete! Welcome to Wave!");

      setTimeout(() => {
        window.electronAPI?.navigation?.navigateTo("/dashboard");
      }, 1000);
    } catch (error) {
      toast.error("Failed to complete setup");
    }
  };

  const navigateToStep = (stepIndex) => {
    setCurrentStep(stepIndex);
    const step = steps[stepIndex];
    if (step?.onStepEnter) {
      setTimeout(() => {
        step.onStepEnter();
      }, 50);
    }
  };

  return (
    <div className={`min-h-screen bg-bg-primary-light dark:bg-bg-primary-dark transition-colors duration-fast ${currentPlayer ? "pb-24" : ""}`}>
      {/* Progress bar */}
      <div className="bg-bg-surface-light dark:bg-bg-surface-dark border-b border-border-light-light dark:border-border-light-dark h-20 transition-colors duration-fast">
        <div className="max-w-2xl mx-auto px-xxxl py-lg">
          <div className="flex items-center justify-between text-sm text-text-secondary-light dark:text-text-secondary-dark mb-md transition-colors duration-fast">
            <span>Setup Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-border-medium-light dark:bg-border-medium-dark rounded-full h-1 transition-colors duration-fast">
            <div
              className="bg-primary-light dark:bg-primary-dark h-1 rounded-full transition-all duration-medium"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-xxxl py-xxxxl">
        <div className="text-center mb-xxxl">
          <h1 className="text-xxl font-light text-text-primary-light dark:text-text-primary-dark mb-md transition-colors duration-fast">
            {currentStepData.title}
          </h1>
          <p className="text-base text-text-body-light dark:text-text-body-dark transition-colors duration-fast">{currentStepData.description}</p>
        </div>

        <div className="bg-bg-primary-light dark:bg-bg-primary-dark transition-colors duration-fast">{currentStepData.content}</div>

        {/* Navigation */}
        <div className="flex justify-between max-w-lg mx-auto mt-xxxl">
          <Button
            variant="ghost"
            onClick={() => navigateToStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
          >
            Previous
          </Button>

          <Button
            variant="primary"
            onClick={handleNext}
            disabled={!canProceed()}
          >
            {currentStep === steps.length - 1 ? "Complete Setup" : "Next"}
          </Button>
        </div>

        {/* Step indicators */}
        <div className="flex justify-center mt-xxxl gap-md">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`w-2 h-2 rounded-full transition-colors duration-fast ${
                index <= currentStep ? "bg-primary-light dark:bg-primary-dark" : "bg-border-medium-light dark:bg-border-medium-dark"
              }`}
            />
          ))}
        </div>
      </div>

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

export default SetupPage;