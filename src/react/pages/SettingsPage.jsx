import React, { useState, useEffect } from "react";
import Button from "../components/Button";
import toast from "react-hot-toast";
import {
  DEFAULT_SETTINGS,
  getShortcutToLabel
} from "../utils/constants";
import PromptEditModal from "../components/PromptEditModal";


const SettingsPage = () => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const [isRecordingShortcut, setIsRecordingShortcut] = useState(null);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);

  const [permissions, setPermissions] = useState({
    accessibility: false,
    microphone: false,
  });

  const storageOptions = [
    { value: "7days", label: "7 days" },
    { value: "14days", label: "14 days" },
    { value: "1month", label: "1 month" },
    { value: "2months", label: "2 months" },
    { value: "6months", label: "6 months" },
    { value: "forever", label: "Forever" },
  ];

  const startShortcutRecording = async (shortcutType) => {
    // if recording is going on, ignore
    if (isRecordingShortcut) {
      return;
    }

    try {
      setIsRecordingShortcut(shortcutType);
      toast.success("Press any key combination...");

      // Tell main process to start recording
      await window.electronAPI?.shortcuts?.startRecording(shortcutType);
    } catch (error) {
      console.error("Failed to start shortcut recording:", error);
      setIsRecordingShortcut(null);
      toast.error("Failed to start recording");
    }
  };

  const resetShortcuts = () => {
    const nSettings = {
      ...settings,
      ...{
        holdShortcut: DEFAULT_SETTINGS.holdShortcut,
        toggleShortcut: DEFAULT_SETTINGS.toggleShortcut,
      },
    };

    saveSettings(nSettings);
    setTimeout(() => {
      loadSettings();
    }, 1000);
    toast.success("Shortcuts reset to defaults");
  };

  useEffect(() => {
    loadSettings();
    checkPermissions();

    // Listen for shortcut recording results
    const handleShortcutRecorded = (data) => {
      loadSettings();
      setIsRecordingShortcut(null);
    };

    // Set up listener if available
    const unsubscribeShortcut = window.electronAPI?.shortcuts?.onShortcutRecorded?.(
      handleShortcutRecorded
    );

    // Listen for permission changes from main process
    const unsubscribePermissions = window.electronAPI?.permissions?.onPermissionsChanged?.((permissionState) => {
      console.log("[SETTINGS] Permission state changed:", permissionState);
      setPermissions(permissionState);
    });

    return () => {
      if (unsubscribeShortcut) unsubscribeShortcut();
      if (unsubscribePermissions) unsubscribePermissions();
    };
  }, [isRecordingShortcut, settings]);

  const loadSettings = async () => {
    try {
      const result = await window.electronAPI?.store?.get("appSettings");
      if (result) {
        setSettings({ ...settings, ...result });
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  };

  const saveSettings = async (newSettings) => {
    try {
      await window.electronAPI?.store?.set("appSettings", newSettings);
      setSettings(newSettings);
      toast.success("Settings saved");
    } catch (error) {
      toast.error("Failed to save settings");
    }
  };

  const checkPermissions = async () => {
    try {
      const accessibilityResult =
        await window.electronAPI?.permissions?.checkAccessibility();
      const microphoneResult =
        await window.electronAPI?.permissions?.checkMicrophone();

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
      toast.success(
        "Please grant accessibility permissions in System Preferences"
      );

      // Check again after a delay
      setTimeout(() => {
        checkPermissions();
      }, 2000);
    } catch (error) {
      toast.error("Failed to open accessibility settings");
    }
  };

  const handlePromptSave = async (newPrompt) => {
    try {
      // Update the llmPrompt in settings
      const updatedSettings = { ...settings, llmPrompt: newPrompt };
      setSettings(updatedSettings);
      
      // Save to electron store
      await handleInputChange("llmPrompt", newPrompt);
      
      toast.success("Prompt updated successfully");
    } catch (error) {
      console.error("Failed to save prompt:", error);
      toast.error("Failed to save prompt");
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
      toast("Opening Privacy Settings. Please enable microphone access for A1.");
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

  const resetToDefaults = () => {
    if (
      window.confirm("Are you sure you want to reset all settings to defaults?")
    ) {
      saveSettings(DEFAULT_SETTINGS);
    }
  };

  const handleInputChange = async (key, value) => {
    const newSettings = { ...settings, [key]: value };

    if (key === "autoStart") {
      try {
        await window.electronAPI?.app?.setStartAtLogin(value);
        saveSettings(newSettings);
        toast.success(
          value ? "A1 will start at login" : "A1 will not start at login"
        );
      } catch (error) {
        toast.error("Failed to update start at login setting");
      }
    } else {
      saveSettings(newSettings);

      // Notify main process of setting changes that affect recording behavior
      if (
        [
          "copyToClipboard",
          "autoPasteToCursor",
          "playAudio",
          "storageHistory",
          "autoCleanup",
          "enhancedPrompts",
        ].includes(key)
      ) {
        try {
          const recordingSettings = {};
          recordingSettings[key] = value;
          console.log(
            "[FRONTEND] Updating recording setting:",
            key,
            "=",
            value
          );
          await window.electronAPI?.settings?.updateRecordingSettings(
            recordingSettings
          );
          console.log(
            "[FRONTEND] Recording setting update sent to main process"
          );
        } catch (error) {
          console.error("Failed to update recording settings:", error);
        }
      }
    }
  };


  return (
    <div className="p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="text text-gray-600 mt-1">
          Configure your voice transcription preferences
        </p>
      </div>

      {/* Permissions */}
      <h2 className="text-base font-medium text-gray-900 mb-1 mt-4">
        Permissions
      </h2>
      <div className="bg-gray-50 rounded-lg border border-gray-50 bg-gray-50 p-4">
        <div className="space-y-4">
          {/* Accessibility */}
          <div className="flex items-center justify-between p-1 bg-gray-50 rounded-lg">
            <div className="flex items-center">
              <div
                className={`w-3 h-3 rounded-full mr-3 ${
                  permissions.accessibility ? "bg-green-500" : "bg-red-500"
                }`}
              ></div>
              <div>
                <h3 className="font-medium text-sm text-gray-900">
                  Accessibility
                </h3>
                <p className="text-xs text-gray-600">
                  Required for global keyboard shortcuts
                </p>
              </div>
            </div>
            <Button
              variant={permissions.accessibility ? "success" : "primary"}
              size="sm"
              state={permissions.accessibility ? "success" : "default"}
              onClick={requestAccessibilityPermission}
            >
              {permissions.accessibility ? "Granted" : "Grant Permission"}
            </Button>
          </div>

          {/* Microphone */}
          <div className="flex items-center justify-between p-1 bg-gray-50 rounded-lg">
            <div className="flex items-center">
              <div
                className={`w-3 h-3 rounded-full mr-3 ${
                  permissions.microphone ? "bg-green-500" : "bg-red-500"
                }`}
              ></div>
              <div>
                <h3 className="font-medium text-sm text-gray-900">
                  Microphone
                </h3>
                <p className="text-xs text-gray-600">
                  Required for voice recording
                </p>
              </div>
            </div>
            <Button
              variant={permissions.microphone ? "success" : "primary"}
              size="sm"
              state={permissions.microphone ? "success" : "default"}
              onClick={requestMicrophonePermission}
            >
              {permissions.microphone ? "Granted" : "Grant Permission"}
            </Button>
          </div>
        </div>
      </div>

      <h2 className="text-base font-medium text-gray-900 mb-1 mt-4">
        Keyboard Shortcuts
      </h2>
      <div className="bg-gray-50 rounded-lg border border-gray-50 bg-gray-50 p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-sm text-gray-900">
                Hold to Record
              </label>
              <p className="text-xs text-gray-600">
                Press and hold to start recording, release to stop
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-2 px-3 py-2">
                <span className="text-sm">
                  {getShortcutToLabel(settings.holdShortcut.start)}
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => startShortcutRecording("holdShortcut")}
                disabled={isRecordingShortcut === "holdShortcut"}
              >
                {isRecordingShortcut === "holdShortcut"
                  ? "Press any key..."
                  : "Change"}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-sm text-gray-900">
                Toggle Recording
              </label>
              <p className="text-xs text-gray-600">
                Press once to start, press again to stop
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-2 px-3 py-2">
                <span className="text-sm">
                  {getShortcutToLabel(settings.toggleShortcut.start)}
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => startShortcutRecording("toggleShortcut")}
                disabled={isRecordingShortcut === "toggleShortcut"}
              >
                {isRecordingShortcut === "toggleShortcut"
                  ? "Press any key..."
                  : "Change"}
              </Button>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="ghost" size="sm" onClick={resetShortcuts}>
              Reset Shortcuts
            </Button>
          </div>
        </div>
      </div>

      <h2 className="text-base font-medium text-gray-900 mt-4 mb-1">General</h2>
      <div className="bg-gray-50 rounded-lg border border-gray-50 bg-gray-50 p-4">
        <div className="space-y-6">
          {/* Language */}
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-sm text-gray-900">
                Default Language
              </label>
              <p className="text-xs text-gray-600">
                Primary language for voice recognition
              </p>
            </div>
            <select
              value={settings.language}
              onChange={(e) => handleInputChange("language", e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="it">Italian</option>
            </select>
          </div>

          {/* Auto Start */}
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-sm text-gray-900">
                Start at Login
              </label>
              <p className="text-xs text-gray-600">
                Automatically start A1 when you log in
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoStart}
                onChange={(e) =>
                  handleInputChange("autoStart", e.target.checked)
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
            </label>
          </div>

          {/* Copy to Clipboard */}
          {/* <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-sm text-gray-900">
                Auto copy to clipboard
              </label>
              <p className="text-xs text-gray-600">
                Automatically copy transcriptions to clipboard
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.copyToClipboard}
                onChange={(e) =>
                  handleInputChange("copyToClipboard", e.target.checked)
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
            </label>
          </div> */}

          {/* Auto Paste to Cursor */}
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-sm text-gray-900">
                Auto paste to cursor
              </label>
              <p className="text-xs text-gray-600">
                Automatically paste transcriptions where cursor is located
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoPasteToCursor}
                onChange={(e) =>
                  handleInputChange("autoPasteToCursor", e.target.checked)
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
            </label>
          </div>

          {/* Enhanced Prompts */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label className="font-medium text-sm text-gray-900">
                Enhanced transcription
              </label>
              <p className="text-xs text-gray-600">
                Use LLM to clean up and format transcriptions with better grammar and punctuation
              </p>
              {settings.enhancedPrompts !== false && (
                <button
                  onClick={() => setIsPromptModalOpen(true)}
                  className="text-xs text-sky-600 hover:text-sky-700 mt-1 font-medium underline"
                >
                  Edit prompt
                </button>
              )}
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enhancedPrompts !== false} // Default to true
                onChange={(e) =>
                  handleInputChange("enhancedPrompts", e.target.checked)
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
            </label>
          </div>

          {/* Play Audio */}
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-sm text-gray-900">
                Play audio feedback
              </label>
              <p className="text-xs text-gray-600">
                Play sound effects when recording starts/stops
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.playAudio}
                onChange={(e) =>
                  handleInputChange("playAudio", e.target.checked)
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Data Management */}
      <h2 className="text-base font-medium text-gray-900 mt-4 mb-1">
        Data Management
      </h2>
      <div className="bg-gray-50 rounded-lg border border-gray-50 bg-gray-50 p-4">
        <div className="space-y-6">
          {/* Storage History */}
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-sm text-gray-900">
                Storage History
              </label>
              <p className="text-xs text-gray-600">
                How long to keep recordings and transcriptions
              </p>
            </div>
            <select
              value={settings.storageHistory}
              onChange={(e) => {
                const value = e.target.value;
                const newSettings = {
                  ...settings,
                  storageHistory: value,
                  autoCleanup: value !== "forever",
                };
                saveSettings(newSettings);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {storageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Auto Cleanup */}
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-sm text-gray-900">
                Auto Cleanup
              </label>
              <p className="text-xs text-gray-600">
                {settings.storageHistory === "forever"
                  ? "Disabled when storage is set to forever"
                  : "Automatically delete old recordings based on storage history setting"}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoCleanup}
                onChange={(e) =>
                  handleInputChange("autoCleanup", e.target.checked)
                }
                disabled={settings.storageHistory === "forever"}
                className="sr-only peer"
              />
              <div
                className={`w-11 h-6 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${
                  settings.storageHistory === "forever"
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-gray-200 peer-checked:bg-sky-600"
                }`}
              ></div>
            </label>
          </div>
        </div>
      </div>

      {/* Actions */}
      <h2 className="text-base font-medium text-gray-900 mt-4 mb-1">Actions</h2>
      <div className="bg-gray-50 rounded-lg border border-gray-50 bg-gray-50 p-4">
        <div className="flex space-x-4">
          <Button variant="secondary" onClick={resetToDefaults}>
            Reset to Defaults
          </Button>

          <Button
            variant="secondary"
            onClick={() => window.electronAPI?.navigation?.navigateTo("/setup")}
          >
            Run Setup Again
          </Button>
        </div>
      </div>

      {/* App Info */}
      <h2 className="text-base font-medium text-gray-900 mt-4 mb-1">
        About A1
      </h2>
      <div className="bg-gray-50 rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-gray-600">Version:</span>
            <p className="font-medium text-gray-900">1.0.0</p>
          </div>
          <div>
            <span className="text-gray-600">Platform:</span>
            <p className="font-medium text-gray-900">macOS</p>
          </div>
          <div>
            <span className="text-gray-600">Maintained by:</span>
            <p className="font-medium text-gray-900">www.siddg.com</p>
          </div>
          <div>
            <span className="text-gray-600">AI Engine:</span>
            <p className="font-medium text-gray-900">OpenAI Whisper</p>
          </div>
        </div>
      </div>
      
      {/* Logs */}
      <h2 className="text-base font-medium text-gray-900 mt-4 mb-1">Logs</h2>
      <div className="bg-gray-50 rounded-lg border border-gray-50 bg-gray-50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm text-gray-900">Debug Logs</p>
            <p className="text-xs text-gray-600 mt-1">
              Access debug logs for troubleshooting. Share these logs when reporting issues.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              try {
                const result = await window.electronAPI?.app?.openLogsFolder();
                if (result?.success) {
                  toast.success("Logs folder opened");
                } else {
                  toast.error("Failed to open logs folder");
                }
              } catch (error) {
                console.error("Error opening logs folder:", error);
                toast.error("Failed to open logs folder");
              }
            }}
          >
            Open Logs Folder
          </Button>
        </div>
      </div>
      
      {/* Prompt Edit Modal */}
      <PromptEditModal
        isOpen={isPromptModalOpen}
        onClose={() => setIsPromptModalOpen(false)}
        onSave={handlePromptSave}
        currentPrompt={settings.llmPrompt}
        defaultPrompt={`Clean up this transcription by fixing grammar, punctuation, and formatting. Keep the exact same meaning and content. Do not add any explanations, summaries, or descriptions of changes made. Output ONLY the cleaned text.`}
      />
    </div>
  );
};

export default SettingsPage;
