import React, { useState, useEffect } from "react";
import Button from "../components/Button";
import toast from "react-hot-toast";
import {
  DEFAULT_SETTINGS,
  getShortcutToLabel
} from "../utils/constants";
import PromptEditModal from "../components/PromptEditModal";
import { useTheme } from "../contexts/ThemeContext";


const SettingsPage = () => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const { themeMode, setTheme } = useTheme();

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
          value ? "Wave will start at login" : "Wave will not start at login"
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
    <div className="space-y-xxxl p-xxxl bg-bg-primary-light dark:bg-bg-primary-dark min-h-screen transition-colors duration-fast">
      {/* Header */}
      <div>
        <h1 className="text-xxl font-bold text-text-primary-light dark:text-text-primary-dark transition-colors duration-fast">Settings</h1>
        <p className="text-base text-text-body-light dark:text-text-body-dark mt-md transition-colors duration-fast">
          Configure your voice transcription preferences
        </p>
      </div>

      {/* Permissions */}
      <div>
        <h2 className="text-base font-medium text-text-primary-light dark:text-text-primary-dark mb-md transition-colors duration-fast">
          Permissions
        </h2>
        <div className="bg-bg-surface-light dark:bg-bg-surface-dark rounded-lg border border-border-light-light dark:border-border-light-dark p-xl transition-colors duration-fast">
          <div className="space-y-lg">
            {/* Accessibility */}
            <div className="flex items-center justify-between p-sm transition-colors duration-fast">
              <div className="flex items-center">
                <div
                  className={`w-3 h-3 rounded-full mr-lg transition-colors duration-fast ${
                    permissions.accessibility ? "bg-success-light dark:bg-success-dark" : "bg-error-light dark:bg-error-dark"
                  }`}
                ></div>
                <div>
                  <h3 className="font-medium text-sm text-text-primary-light dark:text-text-primary-dark transition-colors duration-fast">
                    Accessibility
                  </h3>
                  <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark transition-colors duration-fast">
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
            <div className="flex items-center justify-between p-sm transition-colors duration-fast">
              <div className="flex items-center">
                <div
                  className={`w-3 h-3 rounded-full mr-lg transition-colors duration-fast ${
                    permissions.microphone ? "bg-success-light dark:bg-success-dark" : "bg-error-light dark:bg-error-dark"
                  }`}
                ></div>
                <div>
                  <h3 className="font-medium text-sm text-text-primary-light dark:text-text-primary-dark transition-colors duration-fast">
                    Microphone
                  </h3>
                  <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark transition-colors duration-fast">
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
      </div>

      <div>
        <h2 className="text-base font-medium text-text-primary-light dark:text-text-primary-dark mb-md transition-colors duration-fast">
          Keyboard Shortcuts
        </h2>
        <div className="bg-bg-surface-light dark:bg-bg-surface-dark rounded-lg border border-border-light-light dark:border-border-light-dark p-xl transition-colors duration-fast">
          <div className="space-y-lg">
            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium text-sm text-text-primary-light dark:text-text-primary-dark transition-colors duration-fast">
                  Hold to Record
                </label>
                <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark transition-colors duration-fast">
                  Press and hold to start recording, release to stop
                </p>
              </div>
              <div className="flex items-center gap-md">
                <div className="flex items-center gap-md px-lg py-md">
                  <span className="text-sm text-text-body-light dark:text-text-body-dark transition-colors duration-fast">
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
                <label className="font-medium text-sm text-text-primary-light dark:text-text-primary-dark transition-colors duration-fast">
                  Toggle Recording
                </label>
                <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark transition-colors duration-fast">
                  Press once to start, press again to stop
                </p>
              </div>
              <div className="flex items-center gap-md">
                <div className="flex items-center gap-md px-lg py-md">
                  <span className="text-sm text-text-body-light dark:text-text-body-dark transition-colors duration-fast">
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

            <div className="flex justify-end pt-md">
              <Button variant="ghost" size="sm" onClick={resetShortcuts}>
                Reset Shortcuts
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-base font-medium text-text-primary-light dark:text-text-primary-dark mb-md transition-colors duration-fast">General</h2>
        <div className="bg-bg-surface-light dark:bg-bg-surface-dark rounded-lg border border-border-light-light dark:border-border-light-dark p-xl transition-colors duration-fast">
          <div className="space-y-xxxl">
            {/* Language */}
            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium text-sm text-text-primary-light dark:text-text-primary-dark transition-colors duration-fast">
                  Default Language
                </label>
                <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark transition-colors duration-fast">
                  Primary language for voice recognition
                </p>
              </div>
              <select
                value={settings.language}
                onChange={(e) => handleInputChange("language", e.target.value)}
                className="px-lg py-md border text-text-primary-light dark:text-text-primary-dark bg-bg-primary-light dark:bg-bg-primary-dark border-border-medium-light dark:border-border-medium-dark rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-light dark:focus:ring-primary-dark transition-colors duration-fast"
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
                <label className="font-medium text-sm text-text-primary-light dark:text-text-primary-dark transition-colors duration-fast">
                  Start at Login
                </label>
                <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark transition-colors duration-fast">
                  Automatically start Wave when you log in
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
                <div className="w-11 h-6 bg-border-medium-light dark:bg-border-medium-dark rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border-light-light dark:after:border-border-light-dark after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-light dark:peer-checked:bg-primary-dark transition-colors duration-fast"></div>
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
                <label className="font-medium text-sm text-text-primary-light dark:text-text-primary-dark transition-colors duration-fast">
                  Auto paste to cursor
                </label>
                <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark transition-colors duration-fast">
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
                <div className="w-11 h-6 bg-border-medium-light dark:bg-border-medium-dark rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border-light-light dark:after:border-border-light-dark after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-light dark:peer-checked:bg-primary-dark transition-colors duration-fast"></div>
              </label>
            </div>

            {/* Enhanced Prompts */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <label className="font-medium text-sm text-text-primary-light dark:text-text-primary-dark transition-colors duration-fast">
                  Enhanced transcription
                </label>
                <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark transition-colors duration-fast">
                  Use LLM to clean up and format transcriptions with better grammar and punctuation
                </p>
                {settings.enhancedPrompts !== false && (
                  <button
                    onClick={() => setIsPromptModalOpen(true)}
                    className="text-xs text-primary-light dark:text-primary-dark hover:text-primary-light/80 dark:hover:text-primary-dark/80 mt-xs font-medium underline transition-colors duration-fast"
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
                <div className="w-11 h-6 bg-border-medium-light dark:bg-border-medium-dark rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border-light-light dark:after:border-border-light-dark after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-light dark:peer-checked:bg-primary-dark transition-colors duration-fast"></div>
              </label>
            </div>

            {/* Play Audio */}
            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium text-sm text-text-primary-light dark:text-text-primary-dark transition-colors duration-fast">
                  Play audio feedback
                </label>
                <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark transition-colors duration-fast">
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
                <div className="w-11 h-6 bg-border-medium-light dark:bg-border-medium-dark rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border-light-light dark:after:border-border-light-dark after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-light dark:peer-checked:bg-primary-dark transition-colors duration-fast"></div>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Theme */}
      <div>
        <h2 className="text-base font-medium text-text-primary-light dark:text-text-primary-dark mb-md transition-colors duration-fast">Theme</h2>
        <div className="bg-bg-surface-light dark:bg-bg-surface-dark rounded-lg border border-border-light-light dark:border-border-light-dark p-xl transition-colors duration-fast">
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-sm text-text-primary-light dark:text-text-primary-dark transition-colors duration-fast">
                Appearance
              </label>
              <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark transition-colors duration-fast">
                Choose how Wave looks. System will match your OS settings.
              </p>
            </div>
            <select
              value={themeMode}
              onChange={(e) => {
                setTheme(e.target.value);
                toast.success(`Theme set to ${e.target.value}`);
              }}
              className="px-lg py-md border text-text-primary-light dark:text-text-primary-dark bg-bg-primary-light dark:bg-bg-primary-dark border-border-medium-light dark:border-border-medium-dark rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-light dark:focus:ring-primary-dark transition-colors duration-fast"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </div>
        </div>
      </div>

      {/* Data Management */}
      <div>
        <h2 className="text-base font-medium text-text-primary-light dark:text-text-primary-dark mb-md transition-colors duration-fast">
          Data Management
        </h2>
        <div className="bg-bg-surface-light dark:bg-bg-surface-dark rounded-lg border border-border-light-light dark:border-border-light-dark p-xl transition-colors duration-fast">
          <div className="space-y-xxxl">
            {/* Storage History */}
            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium text-sm text-text-primary-light dark:text-text-primary-dark transition-colors duration-fast">
                  Storage History
                </label>
                <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark transition-colors duration-fast">
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
                className="px-lg py-md text-text-primary-light dark:text-text-primary-dark bg-bg-primary-light dark:bg-bg-primary-dark border border-border-medium-light dark:border-border-medium-dark rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-light dark:focus:ring-primary-dark transition-colors duration-fast"
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
                <label className="font-medium text-sm text-text-primary-light dark:text-text-primary-dark transition-colors duration-fast">
                  Auto Cleanup
                </label>
                <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark transition-colors duration-fast">
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
                  className={`w-11 h-6 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border-light-light dark:after:border-border-light-dark after:border after:rounded-full after:h-5 after:w-5 after:transition-all transition-colors duration-fast ${
                    settings.storageHistory === "forever"
                      ? "bg-border-light-light dark:bg-border-light-dark cursor-not-allowed"
                      : "bg-border-medium-light dark:bg-border-medium-dark peer-checked:bg-primary-light dark:peer-checked:bg-primary-dark"
                  }`}
                ></div>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div>
        <h2 className="text-base font-medium text-text-primary-light dark:text-text-primary-dark mb-md transition-colors duration-fast">Actions</h2>
        <div className="bg-bg-surface-light dark:bg-bg-surface-dark rounded-lg border border-border-light-light dark:border-border-light-dark p-xl transition-colors duration-fast">
          <div className="flex gap-lg">
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
      </div>

      {/* App Info */}
      <div>
        <h2 className="text-base font-medium text-text-primary-light dark:text-text-primary-dark mb-md transition-colors duration-fast">
          About Wave
        </h2>
        <div className="bg-bg-surface-light dark:bg-bg-surface-dark rounded-lg border border-border-light-light dark:border-border-light-dark p-xxxl transition-colors duration-fast">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-lg text-xs">
            <div>
              <span className="text-text-secondary-light dark:text-text-secondary-dark transition-colors duration-fast">Version:</span>
              <p className="font-medium text-text-primary-light dark:text-text-primary-dark transition-colors duration-fast">1.0.0</p>
            </div>
            <div>
              <span className="text-text-secondary-light dark:text-text-secondary-dark transition-colors duration-fast">Platform:</span>
              <p className="font-medium text-text-primary-light dark:text-text-primary-dark transition-colors duration-fast">macOS</p>
            </div>
            <div>
              <span className="text-text-secondary-light dark:text-text-secondary-dark transition-colors duration-fast">Maintained by:</span>
              <p className="font-medium text-text-primary-light dark:text-text-primary-dark transition-colors duration-fast">www.siddg.com</p>
            </div>
            <div>
              <span className="text-text-secondary-light dark:text-text-secondary-dark transition-colors duration-fast">AI Engine:</span>
              <p className="font-medium text-text-primary-light dark:text-text-primary-dark transition-colors duration-fast">OpenAI Whisper</p>
            </div>
          </div>
        </div>
      </div>

      {/* Logs */}
      <div>
        <h2 className="text-base font-medium text-text-primary-light dark:text-text-primary-dark mb-md transition-colors duration-fast">Logs</h2>
        <div className="bg-bg-surface-light dark:bg-bg-surface-dark rounded-lg border border-border-light-light dark:border-border-light-dark p-xl transition-colors duration-fast">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm text-text-primary-light dark:text-text-primary-dark transition-colors duration-fast">Debug Logs</p>
              <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-xs transition-colors duration-fast">
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
