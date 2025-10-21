const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  Tray,
  shell,
  screen,
} = require("electron");
const path = require("path");
const Store = require("electron-store");
const fs = require("fs").promises;
const fsSync = require("fs");
const permissions = require("node-mac-permissions");
const { spawn } = require("child_process");
// const whisper = require("whisper-node");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
const AudioService = require("./audioService");

// Set ffmpeg path for fluent-ffmpeg
console.log("[FFMPEG] Configuring ffmpeg...");
console.log("[FFMPEG] ffmpegStatic path:", ffmpegStatic);

if (ffmpegStatic) {
  // In production, the path might need adjustment
  let ffmpegPath = ffmpegStatic;

  if (app.isPackaged && ffmpegPath.includes("app.asar")) {
    // Replace app.asar with app.asar.unpacked for binary files
    ffmpegPath = ffmpegPath.replace("app.asar", "app.asar.unpacked");
    console.log("[FFMPEG] Adjusted path for production:", ffmpegPath);
  }

  // Check if the binary exists
  if (fsSync.existsSync(ffmpegPath)) {
    ffmpeg.setFfmpegPath(ffmpegPath);
    console.log("[FFMPEG] Using bundled ffmpeg from:", ffmpegPath);
  } else {
    console.error("[FFMPEG] ffmpeg binary not found at:", ffmpegPath);
    // Try to find it in the unpacked directory
    const unpackedPath = path.join(
      process.resourcesPath,
      "app.asar.unpacked/node_modules/ffmpeg-static/ffmpeg"
    );
    if (fsSync.existsSync(unpackedPath)) {
      ffmpeg.setFfmpegPath(unpackedPath);
      console.log("[FFMPEG] Found ffmpeg at unpacked path:", unpackedPath);
    } else {
      console.error("[FFMPEG] Could not find ffmpeg binary");
    }
  }
} else {
  console.error("[FFMPEG] ffmpeg-static module not found");
}

const store = new Store();
const isDev = !app.isPackaged;

// Logging configuration
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB
const logFile = isDev
  ? null
  : path.join(app.getPath("userData"), "app-debug.log");
let logStream = null;

// Set up logging based on environment
if (isDev) {
  // In development, keep console logs as is
  console.log("=== Wave App Starting (Development) ===");
} else {
  // In production, redirect logs to file with rotation
  try {
    // Check log file size and rotate if needed
    if (logFile && fsSync.existsSync(logFile)) {
      const stats = fsSync.statSync(logFile);
      if (stats.size > MAX_LOG_SIZE) {
        // Rotate log file
        const backupFile = logFile.replace(".log", `-${Date.now()}.log`);
        fsSync.renameSync(logFile, backupFile);

        // Keep only the last 3 log files
        const logDir = path.dirname(logFile);
        const logFiles = fsSync
          .readdirSync(logDir)
          .filter((f) => f.startsWith("app-debug") && f.endsWith(".log"))
          .map((f) => ({
            name: f,
            path: path.join(logDir, f),
            time: fsSync.statSync(path.join(logDir, f)).mtime,
          }))
          .sort((a, b) => b.time - a.time);

        // Delete old log files
        if (logFiles.length > 3) {
          logFiles.slice(3).forEach((f) => {
            try {
              fsSync.unlinkSync(f.path);
            } catch (e) {
              // Ignore errors
            }
          });
        }
      }
    }

    // Create log stream
    logStream = fsSync.createWriteStream(logFile, { flags: "a" });

    // Override console methods
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    // Only write to file, don't output to console in production
    console.log = function (...args) {
      if (logStream) {
        const timestamp = new Date().toISOString();
        const message = `[${timestamp}] [LOG] ${args.join(" ")}\n`;
        logStream.write(message);
      }
    };

    console.error = function (...args) {
      if (logStream) {
        const timestamp = new Date().toISOString();
        const message = `[${timestamp}] [ERROR] ${args.join(" ")}\n`;
        logStream.write(message);
      }
      // Keep errors visible in production for debugging
      originalError.apply(console, args);
    };

    console.warn = function (...args) {
      if (logStream) {
        const timestamp = new Date().toISOString();
        const message = `[${timestamp}] [WARN] ${args.join(" ")}\n`;
        logStream.write(message);
      }
    };

    // Log startup info to file only
    console.log("=== Wave App Starting (Production) ===");
    console.log("App version:", app.getVersion());
    console.log("Log file:", logFile);
  } catch (error) {
    // If logging setup fails, continue without file logging
    console.error("Failed to set up file logging:", error);
  }
}

// Initialize AudioService
const audioService = new AudioService(store);

// Initialize LLM service
const LLMService = require("./llmService");
const llmService = new LLMService();

// LLM post-processing function for transcripts
async function processTranscriptWithLLM(originalText) {
  console.log("[LLM-PROCESSING] Starting transcript post-processing");
  console.log(
    "[LLM-PROCESSING] Original text length:",
    originalText?.length || 0
  );
  console.log(
    "[LLM-PROCESSING] Original text preview:",
    originalText?.substring(0, 100) || "EMPTY"
  );

  // Check if original text is empty or too short
  if (!originalText || originalText.trim().length < 3) {
    console.warn(
      "[LLM-PROCESSING] Original text is empty or too short, skipping processing"
    );
    return {
      success: true,
      text: originalText || "",
      processed: false,
      error: "Text too short",
    };
  }

  try {
    // Check if enhanced prompts are enabled
    const appSettings = store.get("appSettings", {});
    const enhancedPromptsEnabled = appSettings.enhancedPrompts !== false; // Default to true

    if (!enhancedPromptsEnabled) {
      console.log(
        "[LLM-PROCESSING] Enhanced prompts disabled, using original transcript"
      );
      return {
        success: true,
        text: originalText,
        processed: false,
        skipped: true,
      };
    }

    // Check if there's a selected LLM model
    const selectedLLMModel = store.get("selectedLLMModel");
    if (!selectedLLMModel) {
      console.log(
        "[LLM-PROCESSING] No LLM model selected, using original transcript"
      );
      return { success: true, text: originalText, processed: false };
    }

    // Check if LLM service is available
    if (!llmService) {
      console.error("[LLM-PROCESSING] LLM service not initialized");
      return {
        success: true,
        text: originalText,
        processed: false,
        error: "LLM service not initialized",
      };
    }

    // Check if the model is already loaded, if not load it
    if (!llmService.currentSession) {
      console.log("[LLM-PROCESSING] Loading LLM model:", selectedLLMModel);
      const loadResult = await llmService.loadModel(selectedLLMModel);
      console.log("[LLM-PROCESSING] Load result:", loadResult);
      if (!loadResult.success) {
        console.error(
          "[LLM-PROCESSING] Failed to load LLM model, using original transcript:",
          loadResult.error
        );
        return {
          success: true,
          text: originalText,
          processed: false,
          error: loadResult.error,
        };
      }
    }

    // Get the LLM prompt from settings
    const promptTemplate =
      appSettings.llmPrompt ||
      `Clean up this transcription by fixing grammar, punctuation, and formatting. Keep the exact same meaning and content. Do not add any explanations, summaries, or descriptions of changes made. Output ONLY the cleaned text.`;

    // Replace the placeholder with the actual text
    const prompt = `${promptTemplate}
    
Transcription:
${originalText}`;

    console.log("[LLM-PROCESSING] Sending transcript to LLM for processing: ", {
      prompt,
    });

    // Generate response with reasonable limits
    let llmResult;
    try {
      llmResult = await llmService.generateResponse(prompt, {
        temperature: 0.3, // Lower temperature for more consistent formatting
        maxTokens: Math.max(originalText.length * 2, 512), // Allow room for formatting
        topP: 0.8,
      });
      console.log("[LLM-PROCESSING] LLM generation result:", {
        success: llmResult?.success,
        hasResponse: !!llmResult?.response,
        responseLength: llmResult?.response?.length || 0,
      });
    } catch (genError) {
      console.error("[LLM-PROCESSING] Error during generation:", genError);
      return {
        success: true,
        text: originalText,
        processed: false,
        error: genError.message,
      };
    }

    if (llmResult?.success && llmResult?.response) {
      const processedText = llmResult.response.trim();
      console.log("[LLM-PROCESSING] Successfully processed transcript");
      console.log(
        "[LLM-PROCESSING] Original length:",
        originalText.length,
        "Processed length:",
        processedText.length
      );

      return {
        success: true,
        text: processedText,
        processed: true,
        originalText: originalText,
      };
    } else {
      console.log(
        "[LLM-PROCESSING] LLM generation failed, using original transcript:",
        llmResult?.error || "Unknown error"
      );
      return {
        success: true,
        text: originalText,
        processed: false,
        error: llmResult?.error,
      };
    }
  } catch (error) {
    console.error("[LLM-PROCESSING] Error during LLM processing:", error);
    return { success: true, text: originalText, processed: false };
  }
}

let mainWindow = null;
let pillWindow = null;
let tray = null;
let keyboardListener = null;
let isRecording = false;
let isTranscribing = false;
let recordingTimeout = null;
let recordingStartTime = null;
let lastKeyEventTime = 0;
const KEY_EVENT_DEBOUNCE_MS = 300; // Ignore duplicate events within 300ms

// Permission monitoring
let permissionMonitorInterval = null;
let lastPermissionState = {
  accessibility: null,
  microphone: null,
};

// Sound playing function
function playSound(soundName) {
  try {
    // Check if audio is enabled in settings
    const settings = store.get("appSettings", { playAudio: true });
    if (!settings.playAudio) {
      console.log(
        "[SOUND] Audio disabled in settings, skipping sound:",
        soundName
      );
      return;
    }

    const soundPath = isDev
      ? path.join(__dirname, "assets", "sounds", `${soundName}.wav`)
      : path.join(
          __dirname.replace("app.asar", "app.asar.unpacked"),
          "assets",
          "sounds",
          `${soundName}.wav`
        );
    console.log("[SOUND] Playing sound from:", soundPath);
    console.log("[SOUND] Sound file exists:", fsSync.existsSync(soundPath));

    if (fsSync.existsSync(soundPath)) {
      const { spawn } = require("child_process");
      // Use macOS built-in afplay command to play sound
      const afplay = spawn("afplay", [soundPath], {
        detached: true,
        stdio: "ignore",
      });
      console.log("[SOUND] Started afplay process for:", soundName);
    } else {
      console.error("[SOUND] Sound file not found:", soundPath);
    }
  } catch (error) {
    console.warn("[SOUND] Failed to play sound:", soundName, error);
  }
}

// Permission monitoring system
function startPermissionMonitoring() {
  console.log("[PERMISSIONS] Starting permission monitoring...");

  // Check immediately on start
  checkAndBroadcastPermissions();

  // Then check every 2 seconds
  permissionMonitorInterval = setInterval(() => {
    checkAndBroadcastPermissions();
  }, 2000);
}

function stopPermissionMonitoring() {
  if (permissionMonitorInterval) {
    clearInterval(permissionMonitorInterval);
    permissionMonitorInterval = null;
    console.log("[PERMISSIONS] Stopped permission monitoring");
  }
}

function checkAndBroadcastPermissions() {
  try {
    const currentState = {
      accessibility:
        permissions.getAuthStatus("accessibility") === "authorized",
      microphone: permissions.getAuthStatus("microphone") === "authorized",
    };

    // Check if permissions changed
    if (
      lastPermissionState.accessibility !== currentState.accessibility ||
      lastPermissionState.microphone !== currentState.microphone
    ) {
      console.log("[PERMISSIONS] Permission state changed:", currentState);

      // If accessibility permission just became granted and keyboard listener isn't running, start it
      if (
        currentState.accessibility &&
        !lastPermissionState.accessibility &&
        !keyboardListener
      ) {
        console.log(
          "[PERMISSIONS] Accessibility just granted, starting keyboard listener..."
        );
        setTimeout(() => {
          startKeyboardListener();
        }, 1000);
      }

      // Broadcast to all windows
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("permissions:changed", currentState);
      }
      if (pillWindow && !pillWindow.isDestroyed()) {
        pillWindow.webContents.send("permissions:changed", currentState);
      }

      lastPermissionState = currentState;
    }
  } catch (error) {
    console.error("[PERMISSIONS] Error checking permissions:", error);
  }
}

// Initialize app
function createMainWindow() {
  try {
    console.log("[MAIN] Creating main window...");
    console.log("[MAIN] __dirname:", __dirname);
    console.log("[MAIN] isDev:", isDev);

    app.setActivationPolicy("regular");

    const preloadPath = path.join(__dirname, "preload.js");
    console.log("[MAIN] Preload path:", preloadPath);
    console.log("[MAIN] Preload exists:", fsSync.existsSync(preloadPath));

    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      titleBarStyle: "hiddenInset", // Mac-style title bar with traffic lights
      icon: path.join(__dirname, "../../buildResources/icon.png"), // App icon
      show: true, // Show immediately to prevent window hiding on startup
      focusable: true,
      acceptFirstMouse: true,
      skipTaskbar: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: preloadPath,
      },
    });

    // No need for ready-to-show since we show immediately
    mainWindow.once("ready-to-show", () => {
      console.log("[MAIN] Window ready to show");
      // Window is already shown, just ensure it's focused
      mainWindow.focus();
    });

    // Handle load errors
    mainWindow.webContents.on(
      "did-fail-load",
      (event, errorCode, errorDescription) => {
        console.error("[MAIN] Failed to load:", errorCode, errorDescription);
        // Show devtools for debugging
        mainWindow.webContents.openDevTools();
      }
    );

    if (isDev) {
      mainWindow.loadURL("http://localhost:3000");
      mainWindow.webContents.openDevTools();
    } else {
      // In production, look for build files in the app resources
      const indexPath = path.join(__dirname, "../../build/index.html");
      console.log("[MAIN] Loading index.html from:", indexPath);
      console.log("[MAIN] File exists:", fsSync.existsSync(indexPath));

      if (!fsSync.existsSync(indexPath)) {
        console.error("[MAIN] index.html not found!");
        mainWindow.webContents.openDevTools();
      }

      mainWindow.loadFile(indexPath).catch((err) => {
        console.error("[MAIN] Error loading index.html:", err);
        mainWindow.webContents.openDevTools();
      });
    }

    // Prevent window from closing, just hide it instead
    mainWindow.on("close", (event) => {
      console.log("[MAIN] Window close event, isQuitting:", app.isQuitting);
      if (!app.isQuitting) {
        event.preventDefault();
        mainWindow.hide();
        console.log("[MAIN] Window hidden instead of closed");
      } else {
        console.log("[MAIN] Allowing window to close because app is quitting");
      }
    });

    mainWindow.on("closed", () => {
      console.log("[MAIN] Window closed event");
      mainWindow = null;
    });
  } catch (error) {
    console.error("[MAIN] Error creating main window:", error);
    app.quit();
  }
}

function createPillWindow() {
  if (pillWindow && !pillWindow.isDestroyed()) return pillWindow;

  console.log("[PILL] Creating recording pill window");
  pillWindow = new BrowserWindow({
    width: 100,
    height: 32,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    show: false,
    x: (screen.getPrimaryDisplay().workAreaSize.width - 100) / 2,
    y: 100,
    focusable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // pillWindow.setHiddenInMissionControl(true);

  // EXACT same settings as speak repo for all-workspace visibility
  // pillWindow.setVisibleOnAllWorkspaces(true, {
  //   visibleOnFullScreen: true,
  // });

  // pillWindow.setAlwaysOnTop(true, "floating");
  // pillWindow.setFocusable(false);

  if (isDev) {
    pillWindow.loadURL("http://localhost:3000/pill");
  } else {
    // Load the dedicated pill HTML file
    const pillPath = path.join(__dirname, "../../build/pill.html");
    console.log("[PILL] Loading pill.html from:", pillPath);
    console.log("[PILL] File exists:", fsSync.existsSync(pillPath));
    pillWindow.loadFile(pillPath);
  }

  pillWindow.on("close", (e) => {
    e.preventDefault();
    pillWindow?.hide();
  });

  return pillWindow;
}

function createTray() {
  // Create tray icon with proper sizing for macOS menu bar
  const iconPath = path.join(__dirname, "assets/icons/wave-tray.png");
  tray = new Tray(iconPath);

  // Set as template image for better macOS integration (adapts to light/dark mode)
  tray.setImage(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    // {
    //   label: "Setup",
    //   click: () => {
    //     if (mainWindow) {
    //       mainWindow.show();
    //       mainWindow.focus();
    //       mainWindow.webContents.send("navigate-to", "/setup");
    //     }
    //   },
    // },
    {
      label: "Dashboard",
      click: () => {
        if (mainWindow) {
          if (!mainWindow.isVisible()) {
            mainWindow.show();
          }
          mainWindow.focus();
          app.focus({ steal: true });
          mainWindow.webContents.send("navigate-to", "/dashboard");
        }
      },
    },
    {
      label: "Models",
      click: () => {
        if (mainWindow) {
          if (!mainWindow.isVisible()) {
            mainWindow.show();
          }
          mainWindow.focus();
          app.focus({ steal: true });
          mainWindow.webContents.send("navigate-to", "/models");
        }
      },
    },
    {
      label: "Recordings",
      click: () => {
        if (mainWindow) {
          if (!mainWindow.isVisible()) {
            mainWindow.show();
          }
          mainWindow.focus();
          app.focus({ steal: true });
          mainWindow.webContents.send("navigate-to", "/recordings");
        }
      },
    },
    {
      label: "Settings",
      click: () => {
        if (mainWindow) {
          if (!mainWindow.isVisible()) {
            mainWindow.show();
          }
          mainWindow.focus();
          app.focus({ steal: true });
          mainWindow.webContents.send("navigate-to", "/settings");
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        console.log("[TRAY] Quit clicked");
        // Set quitting flag so window can close
        app.isQuitting = true;

        // Stop all processes before quitting
        stopKeyboardListener();
        stopPermissionMonitoring();

        // Close all windows
        if (pillWindow && !pillWindow.isDestroyed()) {
          pillWindow.destroy();
        }
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.destroy();
        }

        // Force quit after a short delay
        setTimeout(() => {
          app.exit(0);
        }, 200);
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip("Wave Voice Transcription App");

  // Make tray icon clickable to show app
  tray.on('click', () => {
    console.log("[TRAY] Tray icon clicked");
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (!mainWindow.isVisible()) {
        mainWindow.show();
      }
      mainWindow.focus();
      app.focus({ steal: true });
    }
  });
}

const DEFAULT_SHORTCUTS = {
  holdShortcut: {
    start: {
      type: "flagsChanged",
      keyCode: 63,
      flags: 8388864,
    },
    end: {
      type: "flagsChanged",
      keyCode: 63,
      flags: 256,
    },
  },
  toggleShortcut: {
    start: {
      type: "keyDown",
      keyCode: 49,
      flags: 262401,
    },
    end: {
      type: "keyDown",
      keyCode: 49,
      flags: 262401,
    },
  },
};

function startKeyboardListener() {
  // Get current settings for shortcuts
  const settings = store.get("appSettings", DEFAULT_SHORTCUTS);
  const swiftScriptPath = isDev
    ? path.join(__dirname, "../native/keyboard_listener.swift")
    : path.join(
        process.resourcesPath,
        "app.asar.unpacked/src/native/keyboard_listener.swift"
      );
  console.log(
    "[KEYBOARD] Starting keyboard listener with shortcuts:",
    settings.toggleShortcut,
    settings.holdShortcut
  );

  keyboardListener = spawn("swift", [
    swiftScriptPath,
    JSON.stringify(settings),
  ]);

  keyboardListener.stdout.on("data", (data) => {
    const output = data.toString().trim();
    console.log("[KEYBOARD] Output:", output);

    if (output.startsWith("WAVE_EVENT:")) {
      try {
        const eventJson = output.substring(11); // Remove 'WAVE_EVENT:' prefix
        const event = JSON.parse(eventJson);
        handleKeyboardEvent(event);
      } catch (error) {
        console.error("[KEYBOARD] Failed to parse event:", error);
      }
    } else if (output.startsWith("WAVE_ERROR:")) {
      const errorMsg = output.substring(11);
      console.error("[KEYBOARD] Error:", errorMsg);
    }
  });

  keyboardListener.stderr.on("data", (data) => {
    console.error("[KEYBOARD] Stderr:", data.toString());
  });

  keyboardListener.on("close", (code) => {
    console.log("[KEYBOARD] Listener process closed with code:", code);
    keyboardListener = null;
  });

  keyboardListener.on("error", (error) => {
    console.error("[KEYBOARD] Listener process error:", error);
    keyboardListener = null;
  });
}

function stopKeyboardListener() {
  if (keyboardListener) {
    console.log("[KEYBOARD] Stopping keyboard listener...");
    try {
      // Force kill immediately for clean quit
      keyboardListener.kill("SIGKILL");
      console.log("[KEYBOARD] Keyboard listener killed");
    } catch (error) {
      console.error("[KEYBOARD] Error killing listener:", error);
    }
    keyboardListener = null;
  }
}

function handleKeyboardEvent(event) {
  // Add recording flag if in recording mode
  if (isRecordingShortcut) {
    if (recordingShortcutType == "holdShortcut") {
      // in this section we only care about flagsChanged events
      if (recordedShortcuts.length < 2 && event.type === "flagsChanged") {
        // check that event.keyCode must be one of
        // 63 (Globe)
        // 59 (Left ctrl)
        // 58 (Left opt)
        // 55 (Left cmd)
        // 54 (Right cmd)
        // 61 (Right opt)
        if ([63, 59, 58, 55, 54, 61].includes(event.keyCode)) {
          recordedShortcuts.push(event);
        } else {
          // reset
          recordedShortcuts = [
            DEFAULT_SHORTCUTS.holdShortcut.start,
            DEFAULT_SHORTCUTS.holdShortcut.end,
          ];
        }
      } else if (
        recordedShortcuts.length < 2 &&
        event.type !== "flagsChanged"
      ) {
        // reset recordedShortcuts to default
        recordedShortcuts = [
          DEFAULT_SHORTCUTS.holdShortcut.start,
          DEFAULT_SHORTCUTS.holdShortcut.end,
        ];
      }
    } else if (recordingShortcutType == "toggleShortcut") {
      if (event.type === "keyDown") {
        if (recordedShortcuts.length === 0 && event.type == "keyDown") {
          recordedShortcuts.push(event);
        } else if (recordedShortcuts.length === 1 && event.type === "keyDown") {
          recordedShortcuts.push(event);
        } else {
          recordedShortcuts = [
            DEFAULT_SHORTCUTS.toggleShortcut.start,
            DEFAULT_SHORTCUTS.toggleShortcut.end,
          ];
        }
      }
    }

    if (recordedShortcuts.length == 2) {
      // get current shortcuts
      const currentSettings = store.get("appSettings", {});
      // set the recordings
      const newSettings = {
        ...currentSettings,
      };
      if (recordingShortcutType == "holdShortcut") {
        newSettings.holdShortcut = {
          start: recordedShortcuts[0],
          end: recordedShortcuts[1],
        };
      } else {
        newSettings.toggleShortcut = {
          start: recordedShortcuts[0],
          end: recordedShortcuts[1],
        };
      }

      store.set("appSettings", newSettings);

      // turn off recording
      isRecordingShortcut = false;

      // inform frontend
      if (mainWindow) {
        mainWindow.webContents.send("shortcut-recorded", {
          type: recordingShortcutType,
          success: true,
        });
      }
    }
  } else {
    // start recording if the inbound event matches the start of hold or toggle
    const settings = store.get("appSettings", {});
    // if there are no shortcuts set so far, then use default shortcuts
    if (!settings.holdShortcut) {
      settings.holdShortcut = DEFAULT_SHORTCUTS.holdShortcut;
    }
    if (!settings.toggleShortcut) {
      settings.toggleShortcut = DEFAULT_SHORTCUTS.toggleShortcut;
    }

    // Debounce duplicate key events
    const now = Date.now();
    const timeSinceLastEvent = now - lastKeyEventTime;

    // For toggle shortcuts, only process keyDown events and debounce them
    const isToggleShortcut = (
      event.type === settings.toggleShortcut.start.type &&
      event.keyCode === settings.toggleShortcut.start.keyCode &&
      event.flags === settings.toggleShortcut.start.flags
    );

    if (isToggleShortcut && timeSinceLastEvent < KEY_EVENT_DEBOUNCE_MS) {
      console.log(`[KEYBOARD] Ignoring duplicate toggle event (${timeSinceLastEvent}ms since last)`);
      return;
    }

    // now we are in the arena to decide when to start our pill
    if (!isRecording && !isTranscribing) {
      console.log("[KEYBOARD] Not recording, checking if should start...");
      console.log("[KEYBOARD] Event:", event);
      console.log("[KEYBOARD] Expected toggle start:", settings.toggleShortcut.start);
      console.log("[KEYBOARD] Expected hold start:", settings.holdShortcut.start);

      if (
        (event.type === settings.holdShortcut.start.type &&
          event.keyCode === settings.holdShortcut.start.keyCode &&
          event.flags === settings.holdShortcut.start.flags) ||
        isToggleShortcut
      ) {
        console.log("[KEYBOARD] Starting recording via keyboard shortcut");
        if (isToggleShortcut) {
          lastKeyEventTime = now; // Update last event time for toggle
        }
        startRecording();
      }
    } else if (isRecording) {
      console.log("[KEYBOARD] Currently recording, checking if should stop...");
      console.log("[KEYBOARD] Event:", event);
      console.log("[KEYBOARD] Expected toggle end:", settings.toggleShortcut.end);
      console.log("[KEYBOARD] Expected hold end:", settings.holdShortcut.end);

      if (
        (event.type === settings.holdShortcut.end.type &&
          event.keyCode === settings.holdShortcut.end.keyCode &&
          event.flags === settings.holdShortcut.end.flags) ||
        isToggleShortcut
      ) {
        console.log("[KEYBOARD] Stopping recording via keyboard shortcut");
        if (isToggleShortcut) {
          lastKeyEventTime = now; // Update last event time for toggle
        }
        stopRecording();
      } else {
        console.log("[KEYBOARD] Event did not match stop conditions");
      }
    }
  }
}

let pillVisible = false;

// EXACT show function from speak repo with simple screen positioning
function showRecordingPill() {
  console.log("[PILL] showRecordingPill called");
  const win = createPillWindow();
  if (win && !win.isDestroyed() && !pillVisible) {
    pillVisible = true;
    playSound("pill-appear"); // Play appear sound
    win.setOpacity(1);
    win.setIgnoreMouseEvents(false);
    win.setBounds({
      x: (screen.getPrimaryDisplay().workAreaSize.width - 100) / 2,
      y: 100,
      width: 100,
      height: 32,
    });
    win.setAlwaysOnTop(true, "floating");
    win.setFocusable(false);
    if (typeof win.showInactive === "function") {
      win.showInactive();
    } else {
      // win.show();
    }
  }
}

function hideRecordingPill() {
  console.log("[PILL] hideRecordingPill called");
  if (pillWindow && !pillWindow.isDestroyed() && pillVisible) {
    playSound("pill-disappear"); // Play disappear sound
    pillWindow.hide();
    pillVisible = false;
  }
}

async function startRecording() {
  console.log("[RECORDING] Starting recording...");

  // Clear any existing timeout
  if (recordingTimeout) {
    clearTimeout(recordingTimeout);
    recordingTimeout = null;
  }

  isRecording = true;
  recordingStartTime = Date.now();
  console.log("[RECORDING] Set recordingStartTime:", recordingStartTime);

  // Set a timeout to prevent stuck recording state (5 minutes max)
  recordingTimeout = setTimeout(() => {
    console.log("[RECORDING] Recording timeout reached, force stopping...");
    forceResetRecordingState();
  }, 5 * 60 * 1000); // 5 minutes

  // Show recording pill using speak repo method
  showRecordingPill();

  // Update recording state in all windows
  updateRecordingState({ recording: true, transcribing: false });
}

async function stopRecording() {
  console.log("[RECORDING] Stopping recording...");
  isRecording = false;
  isTranscribing = true;

  // Keep pill visible but update to processing state
  updateRecordingState({ recording: false, transcribing: true });

  // Tell pill window to stop recording and get the audio data
  if (pillWindow) {
    pillWindow.webContents.send("stop-recording-and-transcribe");
  }
}

async function transcribeAudio({ audioBuffer, modelId }) {
  console.log("[TRANSCRIBE] Starting transcription with model:", modelId);

  try {
    const modelsDir = path.join(app.getPath("userData"), "models");
    const model = availableModels[modelId];

    if (!model) {
      throw new Error(`Unknown model: ${modelId}`);
    }

    const modelPath = path.join(modelsDir, model.filename);
    if (!fsSync.existsSync(modelPath)) {
      throw new Error(`Model not found: ${modelPath}`);
    }

    // Save audio buffer to temp file
    const tempDir = path.join(app.getPath("userData"), "temp");
    await fs.mkdir(tempDir, { recursive: true });

    const tempAudioPath = path.join(tempDir, `recording-${Date.now()}.wav`);
    await fs.writeFile(tempAudioPath, Buffer.from(audioBuffer));

    console.log("[TRANSCRIBE] Temp audio saved:", tempAudioPath);
    console.log(
      "[TRANSCRIBE] Audio file size:",
      fsSync.statSync(tempAudioPath).size
    );

    // Convert to 16kHz mono WAV for whisper
    const resampledAudioPath = tempAudioPath.replace(".wav", "-16k.wav");
    console.log("[TRANSCRIBE] Converting audio to 16kHz mono...");
    await convertToWav16kMono(tempAudioPath, resampledAudioPath);
    console.log("[TRANSCRIBE] Audio converted:", resampledAudioPath);

    // Use custom whisper execution for production compatibility
    let result;

    if (isDev) {
      // In development, use whisper-node normally
      const whisper = require("whisper-node");
      let transcribeFunction = whisper;
      if (typeof whisper === "object" && whisper.default) {
        transcribeFunction = whisper.default;
      }

      result = await transcribeFunction(
        resampledAudioPath.replace(" ", "\\ "),
        {
          modelPath: modelPath.replace(" ", "\\ "),
          whisperOptions: {
            language: "en",
            word_timestamps: true,
          },
        }
      );
    } else {
      // In production, execute whisper binary directly
      const whisperBinaryPath = path.join(
        process.resourcesPath,
        "app.asar.unpacked/node_modules/whisper-node/lib/whisper.cpp/main"
      );

      console.log("[TRANSCRIBE] Using whisper binary:", whisperBinaryPath);
      console.log(
        "[TRANSCRIBE] Binary exists:",
        fsSync.existsSync(whisperBinaryPath)
      );

      // Execute whisper directly
      const { execSync } = require("child_process");
      const command = `"${whisperBinaryPath}" -m "${modelPath}" -f "${resampledAudioPath}" -l en -otxt --no-timestamps`;

      console.log("[TRANSCRIBE] Running command:", command);

      try {
        // Set working directory to whisper.cpp directory for production
        const whisperDir = path.dirname(whisperBinaryPath);
        console.log("[TRANSCRIBE] Setting working directory:", whisperDir);

        const stdout = execSync(command, {
          encoding: "utf8",
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
          cwd: whisperDir, // Set working directory
          env: {
            ...process.env,
            PATH: `/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${
              process.env.PATH || ""
            }`,
            // Ensure Metal framework can be found
            DYLD_FRAMEWORK_PATH: "/System/Library/Frameworks",
          },
        });

        // Read the generated text file
        const txtPath = resampledAudioPath + ".txt";
        console.log("[TRANSCRIBE] Looking for output file:", txtPath);
        console.log(
          "[TRANSCRIBE] Output file exists:",
          fsSync.existsSync(txtPath)
        );

        if (fsSync.existsSync(txtPath)) {
          const transcription = await fs.readFile(txtPath, "utf8");
          console.log(
            "[TRANSCRIBE] Raw file content:",
            JSON.stringify(transcription)
          );
          console.log("[TRANSCRIBE] File length:", transcription.length);
          result = transcription.trim();
          // Clean up txt file
          if (isDev) {
            await fs.unlink(txtPath);
          } else {
            console.log(
              "[TRANSCRIBE] Keeping txt file for debugging:",
              txtPath
            );
          }
        } else {
          // List files in temp directory for debugging
          const tempFiles = await fs.readdir(path.dirname(resampledAudioPath));
          console.log("[TRANSCRIBE] Files in temp dir:", tempFiles);
          throw new Error("Transcription file not generated");
        }
      } catch (error) {
        console.error("[TRANSCRIBE] Command error:", error);
        throw error;
      }
    }

    // Clean up temp files
    try {
      await fs.unlink(tempAudioPath);
      // Keep resampled file for debugging
      if (isDev) {
        await fs.unlink(resampledAudioPath);
      } else {
        console.log(
          "[TRANSCRIBE] Keeping resampled file for debugging:",
          resampledAudioPath
        );
      }
      console.log("[TRANSCRIBE] Cleaned up temp files");
    } catch (error) {
      console.warn("[TRANSCRIBE] Failed to clean up temp files:", error);
    }

    console.log("[TRANSCRIBE] Raw result:", result);

    let transcription = "";
    if (Array.isArray(result) && result.length > 0) {
      // Smart concatenation that handles punctuation properly
      transcription = result
        .map((segment) => segment.speech || segment.text || "")
        .reduce((acc, text, index) => {
          if (index === 0) return text;

          const trimmedText = text.trim();
          if (!trimmedText) return acc;

          // Check if the text starts with punctuation or symbols that shouldn't have space before it
          // Includes: . , ! ? ; : ) ] ' " - _
          const punctuationAtStart = /^[.,!?;:)\]'"\-_]/.test(trimmedText);

          if (punctuationAtStart) {
            return acc + trimmedText;
          } else {
            return acc + " " + trimmedText;
          }
        }, "")
        .trim();
    } else if (result && typeof result === "object" && result.text) {
      transcription = result.text.trim();
    } else if (typeof result === "string") {
      transcription = result.trim();
    } else {
      console.error(
        "[TRANSCRIBE] Unexpected result format:",
        typeof result,
        result
      );
      throw new Error("No valid transcription returned");
    }

    console.log("[TRANSCRIBE] Transcription result:", transcription);

    // Clear timeout since recording completed successfully
    if (recordingTimeout) {
      clearTimeout(recordingTimeout);
      recordingTimeout = null;
    }

    updateRecordingState({ recording: false, transcribing: false });

    // Don't hide pill here - let the audio-ready handler do it

    // Reset recording state and hide pill after successful transcription
    isTranscribing = false;

    return { success: true, text: transcription };
  } catch (error) {
    console.error("[TRANSCRIBE] Error:", error);

    // Reset state and hide pill on error too
    isTranscribing = false;

    // Clear timeout on error as well
    if (recordingTimeout) {
      clearTimeout(recordingTimeout);
      recordingTimeout = null;
    }

    updateRecordingState({ recording: false, transcribing: false });

    // Don't hide pill here - let the audio-ready handler do it

    return { success: false, error: error.message };
  }
}

async function pasteText(text) {
  console.log("[PASTE] Pasting text:", text.substring(0, 50) + "...");

  try {
    const textPasterPath = isDev
      ? path.join(__dirname, "../native/text_paster.swift")
      : path.join(
          process.resourcesPath,
          "app.asar.unpacked/src/native/text_paster.swift"
        );
    const paster = spawn("swift", [textPasterPath, text], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    return new Promise((resolve, reject) => {
      let output = "";

      paster.stdout.on("data", (data) => {
        output += data.toString();
      });

      paster.on("close", (code) => {
        if (code === 0) {
          console.log("[PASTE] Text pasted successfully");
          resolve({ success: true });
        } else {
          console.error("[PASTE] Failed with code:", code);
          reject(new Error(`Paste failed with code: ${code}`));
        }
      });

      paster.on("error", (error) => {
        console.error("[PASTE] Error:", error);
        reject(error);
      });
    });
  } catch (error) {
    console.error("[PASTE] Error:", error);
    return { success: false, error: error.message };
  }
}

async function saveRecording({
  audioBuffer,
  originalText,
  enhancedText,
  timestamp,
}) {
  console.log("[SAVE] Saving recording...");

  try {
    const recordingsDir = path.join(app.getPath("userData"), "recordings");
    await fs.mkdir(recordingsDir, { recursive: true });

    const recordingId = `recording-${timestamp}`;
    const audioPath = path.join(recordingsDir, `${recordingId}.wav`);

    // Save audio file
    await fs.writeFile(audioPath, Buffer.from(audioBuffer));

    // Calculate recording duration
    const recordingEndTime = Date.now();
    const duration = recordingStartTime
      ? (recordingEndTime - recordingStartTime) / 1000
      : 0;

    console.log("[SAVE] Duration calculation:", {
      recordingStartTime,
      recordingEndTime,
      duration,
      timestamp,
    });

    // Save to recordings store
    const recordings = store.get("recordings", []);
    const recording = {
      id: recordingId,
      text: enhancedText, // Use enhanced text as primary display text
      originalText: originalText, // Store original transcript
      enhancedText: enhancedText, // Store enhanced transcript
      timestamp: timestamp,
      audioPath: audioPath,
      createdAt: new Date().toISOString(),
      duration: duration,
    };

    recordings.unshift(recording);
    store.set("recordings", recordings);

    // Reset recording start time
    recordingStartTime = null;

    console.log("[SAVE] Recording saved:", recordingId);
    return { success: true, id: recordingId, recording: recording };
  } catch (error) {
    console.error("[SAVE] Error:", error);
    return { success: false, error: error.message };
  }
}

function updateRecordingState(state) {
  isRecording = state.recording || false;
  isTranscribing = state.transcribing || false;

  console.log("[STATE] Updating recording state:", {
    isRecording,
    isTranscribing,
  });

  // Show/hide pill using speak repo methods
  if (isRecording || isTranscribing) {
    showRecordingPill();
    if (pillWindow && !pillWindow.isDestroyed()) {
      pillWindow.webContents.send("recording-state-update", state);
    }
  } else {
    console.log("[STATE] Hiding pill window - recording finished");
    hideRecordingPill();
    if (pillWindow && !pillWindow.isDestroyed()) {
      pillWindow.webContents.send("recording-state-update", state);
    }
  }

  // Update main window only if it exists and is not destroyed
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("recording-state-update", state);
  }
}

// Failsafe function to reset states if they get stuck
function forceResetRecordingState() {
  console.log("[STATE] Force resetting recording state");
  console.log(
    "[STATE] Resetting recordingStartTime from:",
    recordingStartTime,
    "to null"
  );

  // Clear timeout
  if (recordingTimeout) {
    clearTimeout(recordingTimeout);
    recordingTimeout = null;
  }

  isRecording = false;
  isTranscribing = false;
  recordingStartTime = null;
  updateRecordingState({ recording: false, transcribing: false });

  // Force hide pill using speak repo method
  hideRecordingPill();
}

function convertToWav16kMono(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioChannels(1)
      .audioFrequency(16000)
      .format("wav")
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .save(outputPath);
  });
}

// App event handlers
app.whenReady().then(async () => {
  try {
    console.log("[APP] App is ready, initializing...");

    // Ensure dock icon is always visible
    app.setActivationPolicy("regular");

    // Start permission monitoring
    startPermissionMonitoring();

    // Set dock icon - use the buildResources icon which should be the custom app icon
    const appIconPath = path.join(__dirname, "../../buildResources/icon.png");
    const fallbackIconPath1 = path.join(__dirname, "assets/icons/mac1024.png");
    const fallbackIconPath2 = path.join(__dirname, "assets/icons/mac512.png");

    try {
      if (process.platform === "darwin" && app.dock) {
        if (fsSync.existsSync(appIconPath)) {
          console.log("[DOCK] Setting dock icon to app icon:", appIconPath);
          app.dock.setIcon(appIconPath);
        } else if (fsSync.existsSync(fallbackIconPath1)) {
          console.log(
            "[DOCK] Setting dock icon to fallback 1024:",
            fallbackIconPath1
          );
          app.dock.setIcon(fallbackIconPath1);
        } else if (fsSync.existsSync(fallbackIconPath2)) {
          console.log(
            "[DOCK] Setting dock icon to fallback 512:",
            fallbackIconPath2
          );
          app.dock.setIcon(fallbackIconPath2);
        } else {
          console.warn("[DOCK] No icon file found at expected paths");
        }
      }
    } catch (error) {
      console.error("[DOCK] Failed to set dock icon:", error);
    }

    createMainWindow();
    createTray();

    // Initialize LLM service
    try {
      await llmService.init();
      console.log("[LLM] Service initialized successfully");
    } catch (error) {
      console.warn("[LLM] Failed to initialize service:", error);
    }

    setTimeout(() => {
      // Create pill window (hidden initially, like speak repo)
      const pillWin = createPillWindow();
      if (pillWin) {
        // Initialize as hidden using speak repo method
        hideRecordingPill();
      }

      if (mainWindow && !mainWindow.isDestroyed()) {
        console.log("[APP] Ensuring main window is visible and focused");
        if (!mainWindow.isVisible()) {
          mainWindow.show();
        }
        mainWindow.focus();
        app.focus({ steal: true });
        app.dock.show();
      }
    }, 1000);

    // Start keyboard listener if setup is complete OR if accessibility is granted (for tutorial)
    const isSetupComplete = store.get("setupComplete", false);
    const accessibilityGranted = permissions.getAuthStatus("accessibility") === "authorized";

    if (isSetupComplete || accessibilityGranted) {
      // Delay keyboard listener start to ensure accessibility permissions
      setTimeout(() => {
        startKeyboardListener();
      }, 3000);
    }

    // Setup auto cleanup
    setupAutoCleanup();

    // Initialize LLM service
    await llmService.init();

    // Add IPC handler to get debug logs (only available in production)
    ipcMain.handle("get-debug-logs", async () => {
      if (!logFile) {
        return {
          success: false,
          error: "Debug logs are only available in production builds",
        };
      }

      try {
        const logs = await fs.readFile(logFile, "utf8");
        return { success: true, logs };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        console.log("[APP] Navigating to initial page, setup complete:", isSetupComplete);
        // Ensure window is visible before navigation
        if (!mainWindow.isVisible()) {
          mainWindow.show();
        }
        mainWindow.focus();
        app.focus({ steal: true });

        if (isSetupComplete) {
          mainWindow.webContents.send("navigate-to", "/dashboard");
        } else {
          mainWindow.webContents.send("navigate-to", "/setup");
        }
      }
    }, 2000); // Allow time for splash screen
  } catch (error) {
    console.error("[APP] Fatal error during initialization:", error);
    app.quit();
  }
});

app.on("window-all-closed", () => {
  console.log("[APP] window-all-closed event fired");
  stopKeyboardListener();
  // On macOS, only quit if explicitly quitting (not just closing window)
  if (process.platform !== "darwin" || app.isQuitting) {
    stopPermissionMonitoring();
    app.quit();
  }
});

// Handle Cmd+Q and system-initiated quits properly
app.on("before-quit", (event) => {
  console.log("[APP] before-quit event fired, isQuitting:", app.isQuitting);
  app.isQuitting = true;

  // Stop all background processes
  stopPermissionMonitoring();
  stopKeyboardListener();

  // Close log stream if it exists
  if (logStream) {
    logStream.end();
    logStream = null;
  }

  // Destroy windows to ensure clean quit
  if (pillWindow && !pillWindow.isDestroyed()) {
    pillWindow.destroy();
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
});

// Handle system-initiated quits (like from System Preferences "Quit and Reopen")
app.on("will-quit", (event) => {
  console.log("[APP] will-quit event fired, isQuitting:", app.isQuitting);
  app.isQuitting = true;
});

app.on("activate", () => {
  console.log("[APP] Activate event triggered");
  app.setActivationPolicy("regular");
  if (BrowserWindow.getAllWindows().length === 0) {
    console.log("[APP] No windows exist, creating main window");
    createMainWindow();
  } else if (mainWindow && !mainWindow.isDestroyed()) {
    console.log("[APP] Main window exists, showing and focusing");
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
    mainWindow.focus();
    app.focus({ steal: true });
  }
});

// IPC handlers for permissions
ipcMain.handle("check-accessibility-permission", async () => {
  try {
    const status = permissions.getAuthStatus("accessibility");
    return { granted: status === "authorized" };
  } catch (error) {
    return { granted: false, error: error.message };
  }
});

ipcMain.handle("request-accessibility-permission", async () => {
  try {
    await permissions.askForAccessibilityAccess();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("open-accessibility-settings", async () => {
  try {
    await shell.openPath("/System/Library/PreferencePanes/Security.prefPane");
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("open-microphone-settings", async () => {
  try {
    // Open System Preferences > Security & Privacy > Privacy > Microphone
    const { exec } = require("child_process");
    exec(
      'open "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"'
    );
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("check-microphone-permission", async () => {
  try {
    const status = permissions.getAuthStatus("microphone");
    return { granted: status === "authorized" };
  } catch (error) {
    return { granted: false, error: error.message };
  }
});

ipcMain.handle("request-microphone-permission", async (event) => {
  try {
    console.log("[PERMISSIONS] Requesting microphone access...");

    // First check current status
    const currentStatus = permissions.getAuthStatus("microphone");
    console.log("[PERMISSIONS] Current microphone status:", currentStatus);

    if (currentStatus === "authorized") {
      return { success: true, alreadyGranted: true };
    }

    // Try to trigger permission prompt through node-mac-permissions
    await permissions.askForMicrophoneAccess();

    // If that doesn't work, we need to trigger actual microphone usage
    // Send a message to renderer to trigger getUserMedia
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
      window.webContents.send("trigger-microphone-request");
    }

    return { success: true };
  } catch (error) {
    console.error("[PERMISSIONS] Error requesting microphone:", error);
    return { success: false, error: error.message };
  }
});

// Setup completion
ipcMain.handle("complete-setup", async () => {
  store.set("setupComplete", true);

  // Start keyboard listener after setup completion
  setTimeout(() => {
    startKeyboardListener();
  }, 1000);

  return { success: true };
});

ipcMain.handle("is-setup-complete", async () => {
  return { complete: store.get("setupComplete", false) };
});

// Simplified recording system - main process drives everything

// Handler for starting recording
ipcMain.handle("recording:start", async () => {
  try {
    console.log("[IPC] Received recording:start request");
    await startRecording();
    return { success: true };
  } catch (error) {
    console.error("[IPC] Failed to start recording:", error);
    return { success: false, error: error.message };
  }
});

// Handler for stopping recording
ipcMain.handle("recording:stop", async () => {
  try {
    console.log("[IPC] Received recording:stop request");
    await stopRecording();
    return { success: true };
  } catch (error) {
    console.error("[IPC] Failed to stop recording:", error);
    return { success: false, error: error.message };
  }
});

// New handler for when pill sends audio data back to main
ipcMain.handle("recording:audio-ready", async (event, audioBuffer) => {
  console.log(
    "[RECORDING] Audio data received from pill, starting transcription..."
  );
  console.log(
    "[RECORDING] recordingStartTime at audio-ready:",
    recordingStartTime
  );

  try {
    // Get selected model
    const selectedModel = store.get("selectedModel");
    if (!selectedModel) {
      throw new Error("No model selected");
    }

    // Transcribe the audio
    const result = await transcribeAudio({
      audioBuffer,
      modelId: selectedModel,
    });

    if (result.success) {
      console.log("[RECORDING] Transcription successful:", result.text);
      console.log(
        "[RECORDING] Transcription length:",
        result.text?.length || 0
      );

      // Process transcript with LLM if available (keep transcribing state)
      console.log("[RECORDING] Starting LLM processing...");
      const processedResult = await processTranscriptWithLLM(result.text);
      console.log("[RECORDING] LLM processing complete:", {
        success: processedResult.success,
        processed: processedResult.processed,
        skipped: processedResult.skipped,
        textLength: processedResult.text?.length || 0,
      });
      const finalText = processedResult.text;

      console.log(
        "[RECORDING] Using text:",
        processedResult.processed ? "LLM-processed" : "original"
      );
      console.log(
        "[RECORDING] Enhanced prompts:",
        processedResult.skipped ? "disabled" : "enabled"
      );
      console.log("[RECORDING] Final text:", finalText);

      // Get current settings
      const settings = store.get("appSettings", {
        copyToClipboard: true,
        autoPasteToCursor: true,
      });

      console.log("[RECORDING] Current settings:", {
        copyToClipboard: settings.copyToClipboard,
        autoPasteToCursor: settings.autoPasteToCursor,
      });

      // Copy to clipboard if enabled
      if (settings.copyToClipboard) {
        try {
          const { clipboard } = require("electron");
          clipboard.writeText(finalText);
          console.log("[CLIPBOARD] Text copied to clipboard");
        } catch (error) {
          console.error("[CLIPBOARD] Failed to copy to clipboard:", error);
        }
      } else {
        console.log("[CLIPBOARD] Skipped - copyToClipboard is disabled");
      }

      // Paste text to cursor location if enabled
      if (settings.autoPasteToCursor) {
        try {
          await pasteText(finalText);
          console.log("[PASTE] Text pasted to cursor location");
        } catch (error) {
          console.error("[PASTE] Failed to paste text:", error);
        }
      } else {
        console.log("[PASTE] Skipped - autoPasteToCursor is disabled");
      }

      // Save recording with both original and enhanced text
      const recordingData = await saveRecording({
        audioBuffer,
        originalText: result.text,
        enhancedText: finalText,
        timestamp: recordingStartTime || Date.now(),
      });

      console.log("[RECORDING] Recording saved successfully");

      // Broadcast recording update to all windows
      if (mainWindow) {
        mainWindow.webContents.send("recording-complete", {
          recording: recordingData.recording,
          success: true,
        });
      }
    } else {
      console.error("[RECORDING] Transcription failed:", result.error);
    }

    // Hide pill after all processing is complete
    console.log("[RECORDING] Hiding pill window after all processing");
    hideRecordingPill();

    return result;
  } catch (error) {
    console.error("[RECORDING] Error processing audio:", error);

    // Hide pill on error too
    hideRecordingPill();

    return { success: false, error: error.message };
  }
});

ipcMain.handle(
  "get-recordings",
  async (event, { page = 0, limit = 15 } = {}) => {
    try {
      console.log(
        "[GET-RECORDINGS] Received params - page:",
        page,
        "limit:",
        limit
      );
      const allRecordings = store.get("recordings", []);
      console.log("[GET-RECORDINGS] Total recordings:", allRecordings.length);

      const startIndex = page * limit;
      const endIndex = startIndex + limit;
      console.log(
        "[GET-RECORDINGS] Calculated indices - start:",
        startIndex,
        "end:",
        endIndex
      );

      const paginatedRecordings = allRecordings.slice(startIndex, endIndex);
      console.log(
        "[GET-RECORDINGS] Returning",
        paginatedRecordings.length,
        "recordings for page",
        page
      );

      return {
        success: true,
        recordings: paginatedRecordings,
        totalCount: allRecordings.length,
        hasMore: endIndex < allRecordings.length,
        currentPage: page,
        totalPages: Math.ceil(allRecordings.length / limit),
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
);

ipcMain.handle("delete-recording", async (event, recordingId) => {
  try {
    // Get current recordings
    const recordings = store.get("recordings", []);
    const recording = recordings.find((r) => r.id === recordingId);

    if (!recording) {
      throw new Error("Recording not found");
    }

    // Delete audio file if it exists
    if (recording.audioPath && fsSync.existsSync(recording.audioPath)) {
      await fs.unlink(recording.audioPath);
      console.log(`[DELETE] Audio file deleted: ${recording.audioPath}`);
    }

    // Remove from store
    const filteredRecordings = recordings.filter((r) => r.id !== recordingId);
    store.set("recordings", filteredRecordings);

    console.log(`[DELETE] Recording ${recordingId} deleted successfully`);
    return { success: true };
  } catch (error) {
    console.error(`[DELETE] Failed to delete recording ${recordingId}:`, error);
    return { success: false, error: error.message };
  }
});

// Store operations (existing code)
ipcMain.handle("store:get", async (event, key) => {
  return store.get(key);
});

ipcMain.handle("store:set", async (event, key, value) => {
  store.set(key, value);
  if (mainWindow) {
    mainWindow.webContents.send("store:changed", { key, value });
  }
  return true;
});

ipcMain.handle("store:delete", async (event, key) => {
  store.delete(key);
  if (mainWindow) {
    mainWindow.webContents.send("store:deleted", { key });
  }
  return true;
});

ipcMain.handle("store:clear", async () => {
  store.clear();
  if (mainWindow) {
    mainWindow.webContents.send("store:cleared");
  }
  return true;
});

// File operations (existing code)
ipcMain.handle("files:save", async (event, fileName, data) => {
  try {
    const userDataPath = app.getPath("userData");
    const filesDir = path.join(userDataPath, "files");

    await fs.mkdir(filesDir, { recursive: true });

    const filePath = path.join(filesDir, fileName);
    await fs.writeFile(filePath, data);

    return { success: true, path: filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("files:read", async (event, fileName) => {
  try {
    const userDataPath = app.getPath("userData");
    const filePath = path.join(userDataPath, "files", fileName);
    const data = await fs.readFile(filePath);

    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("files:read-audio", async (event, audioPath) => {
  try {
    // audioPath is already absolute from recordings
    if (!fsSync.existsSync(audioPath)) {
      throw new Error("Audio file not found");
    }

    const data = await fs.readFile(audioPath);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("files:delete", async (event, fileName) => {
  try {
    const userDataPath = app.getPath("userData");
    const filePath = path.join(userDataPath, "files", fileName);
    await fs.unlink(filePath);

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Navigation handler
ipcMain.handle("navigate-to", async (event, route) => {
  if (mainWindow) {
    mainWindow.webContents.send("navigate-to", route);
  }
  return { success: true };
});

// Model management using Electron's built-in download system
const availableModels = {
  tiny: {
    name: "Whisper Tiny",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
    filename: "ggml-tiny.bin",
  },
  base: {
    name: "Whisper Base",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
    filename: "ggml-base.bin",
  },
  small: {
    name: "Whisper Small",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
    filename: "ggml-small.bin",
  },
  medium: {
    name: "Whisper Medium",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin",
    filename: "ggml-medium.bin",
  },
  "large-v3-turbo": {
    name: "Whisper Large V3 Turbo",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin",
    filename: "ggml-large-v3-turbo.bin",
  },
};

const activeDownloads = new Map(); // modelId -> DownloadItem
const windowDownloadMapping = new WeakMap(); // BrowserWindow -> modelId

ipcMain.handle("model:download", (event, modelId) => {
  const model = availableModels[modelId];
  if (!model) {
    return { success: false, error: "Unknown model ID" };
  }

  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (!win) {
    return { success: false, error: "No window available for download" };
  }

  // Store mapping for this download
  windowDownloadMapping.set(win, modelId);

  // Start download using Electron's built-in system
  win.webContents.downloadURL(model.url);

  return { success: true };
});

// Handle download events
app.on("browser-window-created", (_event, window) => {
  window.webContents.session.on("will-download", (event, item, webContents) => {
    const modelId = windowDownloadMapping.get(window);
    if (!modelId) return;

    const model = availableModels[modelId];
    if (!model) return;

    // Set save path
    const modelsDir = path.join(app.getPath("userData"), "models");
    fsSync.mkdirSync(modelsDir, { recursive: true });
    const savePath = path.join(modelsDir, model.filename);
    item.setSavePath(savePath);

    // Store download item
    activeDownloads.set(modelId, item);

    // Handle progress updates
    item.on("updated", (_event, state) => {
      const progress = item.getTotalBytes()
        ? Math.round((item.getReceivedBytes() / item.getTotalBytes()) * 100)
        : 0;

      // Send progress to all windows
      if (mainWindow) {
        mainWindow.webContents.send("model:download-progress", {
          modelId,
          progress,
          received: item.getReceivedBytes(),
          total: item.getTotalBytes(),
          paused: item.isPaused(),
        });
      }
    });

    // Handle completion
    item.once("done", (_event, state) => {
      if (state === "completed") {
        console.log(`[DOWNLOAD] Model ${modelId} download completed`);

        // Update model status
        const modelStatus = store.get("modelStatus", {});
        console.log(`[DOWNLOAD] Current model status:`, modelStatus);

        // Check if any model is currently selected
        const hasSelectedModel = Object.values(modelStatus).some(
          (status) => status?.selected
        );
        const currentSelectedModel = store.get("selectedModel");

        console.log(
          `[DOWNLOAD] hasSelectedModel: ${hasSelectedModel}, currentSelectedModel: ${currentSelectedModel}`
        );

        // Auto-select this model if no model is currently selected
        const shouldAutoSelect = !hasSelectedModel && !currentSelectedModel;
        console.log(`[DOWNLOAD] shouldAutoSelect: ${shouldAutoSelect}`);

        modelStatus[modelId] = {
          downloaded: true,
          selected: shouldAutoSelect,
        };
        store.set("modelStatus", modelStatus);

        // If auto-selecting, also set it as the selected model
        if (shouldAutoSelect) {
          store.set("selectedModel", modelId);
          console.log(`[AUTO-SELECT] Automatically selected model: ${modelId}`);
        }

        console.log(
          `[DOWNLOAD] Final model status:`,
          store.get("modelStatus", {})
        );
        console.log(`[DOWNLOAD] Selected model:`, store.get("selectedModel"));

        // Notify completion
        if (mainWindow) {
          mainWindow.webContents.send("model:download-complete", {
            modelId,
            success: true,
            autoSelected: shouldAutoSelect,
          });
        }
      } else if (state === "cancelled") {
        if (mainWindow) {
          mainWindow.webContents.send("model:download-complete", {
            modelId,
            success: false,
            error: "Download cancelled",
          });
        }
      } else {
        if (mainWindow) {
          mainWindow.webContents.send("model:download-complete", {
            modelId,
            success: false,
            error: "Download failed: " + state,
          });
        }
      }

      // Cleanup
      activeDownloads.delete(modelId);
      windowDownloadMapping.delete(window);
    });
  });
});

ipcMain.handle("model:get-status", () => {
  const modelStatus = store.get("modelStatus", {});
  const modelsDir = path.join(app.getPath("userData"), "models");

  // Check which models actually exist
  const status = {};
  for (const [modelId, model] of Object.entries(availableModels)) {
    const modelPath = path.join(modelsDir, model.filename);
    const exists = fsSync.existsSync(modelPath);

    status[modelId] = {
      downloaded: exists,
      downloading: activeDownloads.has(modelId),
      selected: modelStatus[modelId]?.selected || false,
      path: exists ? modelPath : null,
    };
  }

  return status;
});

ipcMain.handle("model:select", async (event, modelId) => {
  const model = availableModels[modelId];
  if (!model) {
    return { success: false, error: "Unknown model ID" };
  }

  const modelPath = path.join(
    app.getPath("userData"),
    "models",
    model.filename
  );
  if (!fsSync.existsSync(modelPath)) {
    return { success: false, error: "Model not downloaded" };
  }

  // Update selection in store
  const modelStatus = store.get("modelStatus", {});
  Object.keys(modelStatus).forEach((id) => {
    if (modelStatus[id]) modelStatus[id].selected = false;
  });

  if (!modelStatus[modelId]) {
    modelStatus[modelId] = {};
  }
  modelStatus[modelId].selected = true;

  store.set("modelStatus", modelStatus);
  store.set("selectedModel", modelId);

  return { success: true };
});

ipcMain.handle("model:delete", (event, modelId) => {
  console.log(`[DELETE] Attempting to delete model: ${modelId}`);

  const model = availableModels[modelId];
  if (!model) {
    console.log(`[DELETE] Unknown model ID: ${modelId}`);
    return { success: false, error: "Unknown model ID" };
  }

  const modelPath = path.join(
    app.getPath("userData"),
    "models",
    model.filename
  );
  console.log(`[DELETE] Model path: ${modelPath}`);

  try {
    if (fsSync.existsSync(modelPath)) {
      console.log(`[DELETE] File exists, deleting...`);
      fsSync.unlinkSync(modelPath);
      console.log(`[DELETE] File deleted successfully`);
    } else {
      console.log(`[DELETE] File does not exist: ${modelPath}`);
    }

    // Update store
    const modelStatus = store.get("modelStatus", {});
    console.log(`[DELETE] Current model status:`, modelStatus);

    if (modelStatus[modelId]) {
      modelStatus[modelId].downloaded = false;
      modelStatus[modelId].selected = false;
    }
    store.set("modelStatus", modelStatus);
    console.log(`[DELETE] Updated model status:`, modelStatus);

    // Clear selected model if it was deleted
    const selectedModel = store.get("selectedModel");
    if (selectedModel === modelId) {
      store.delete("selectedModel");
      console.log(`[DELETE] Cleared selected model: ${selectedModel}`);
    }

    console.log(
      `[DELETE] Delete operation completed successfully for ${modelId}`
    );
    return { success: true };
  } catch (error) {
    console.log(`[DELETE] Error deleting model:`, error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("model:pause", (event, modelId) => {
  const item = activeDownloads.get(modelId);
  if (item && !item.isPaused()) {
    item.pause();
    return { success: true };
  }
  return { success: false };
});

ipcMain.handle("model:resume", (event, modelId) => {
  const item = activeDownloads.get(modelId);
  if (item && item.isPaused()) {
    item.resume();
    return { success: true };
  }
  return { success: false };
});

ipcMain.handle("model:cancel", (event, modelId) => {
  const item = activeDownloads.get(modelId);
  if (item) {
    item.cancel();
    return { success: true };
  }
  return { success: false };
});

// Add missing data:query handler to stop the error messages
ipcMain.handle("data:query", (event, options) => {
  // Return empty array for now - this stops the error messages
  return [];
});

// Data cleanup handler
ipcMain.handle("data:cleanup", async (event, olderThan) => {
  try {
    const result = await audioService.cleanupOldRecordings(olderThan);

    // Notify renderer process
    if (mainWindow) {
      mainWindow.webContents.send("data:cleanup-completed", result);
    }

    return result;
  } catch (error) {
    console.error("[CLEANUP] Error during cleanup:", error);
    return { success: false, error: error.message };
  }
});

// Auto cleanup functionality
let autoCleanupInterval = null;

const getRetentionDays = (storageHistory) => {
  const map = {
    "7days": 7,
    "14days": 14,
    "1month": 30,
    "2months": 60,
    "6months": 180,
  };
  return map[storageHistory] || 30;
};

const setupAutoCleanup = () => {
  // Clear existing interval if any
  if (autoCleanupInterval) {
    clearInterval(autoCleanupInterval);
  }

  // Check every 24 hours
  autoCleanupInterval = setInterval(async () => {
    try {
      const settings = store.get("appSettings");
      if (settings?.autoCleanup && settings?.storageHistory !== "forever") {
        const daysToKeep = getRetentionDays(settings.storageHistory);
        console.log(
          `[AUTO-CLEANUP] Running cleanup for ${daysToKeep} days retention`
        );

        const result = await audioService.cleanupOldRecordings(daysToKeep);

        console.log(`[AUTO-CLEANUP] Completed:`, result);

        // Notify renderer process
        if (mainWindow) {
          mainWindow.webContents.send("data:cleanup-completed", result);
        }
      }
    } catch (error) {
      console.error("[AUTO-CLEANUP] Failed:", error);
    }
  }, 24 * 60 * 60 * 1000); // 24 hours

  console.log("[AUTO-CLEANUP] Scheduled to run every 24 hours");
};

// Manual cleanup trigger for settings changes
const triggerCleanupIfNeeded = async () => {
  try {
    const settings = store.get("appSettings");
    if (settings?.autoCleanup && settings?.storageHistory !== "forever") {
      const daysToKeep = getRetentionDays(settings.storageHistory);
      console.log(`[CLEANUP] Manual trigger for ${daysToKeep} days retention`);

      const result = await audioService.cleanupOldRecordings(daysToKeep);
      console.log(`[CLEANUP] Manual cleanup completed:`, result);

      // Notify renderer process
      if (mainWindow) {
        mainWindow.webContents.send("data:cleanup-completed", result);
      }
    }
  } catch (error) {
    console.error("[CLEANUP] Manual cleanup failed:", error);
  }
};

// Shortcut recording state
let isRecordingShortcut = false;
let recordedShortcuts = [];
let recordingShortcutType = null;

// Add handlers for shortcut and settings updates
ipcMain.handle("shortcuts:start-recording", async (event, shortcutType) => {
  try {
    isRecordingShortcut = true;
    recordedShortcuts = [];
    recordingShortcutType = shortcutType;
    console.log(`[SHORTCUTS] Starting recording for ${shortcutType}`);

    return { success: true };
  } catch (error) {
    console.error("[SHORTCUTS] Failed to start recording:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle(
  "settings:update-recording",
  async (event, recordingSettings) => {
    try {
      // Update the stored settings
      const currentSettings = store.get("appSettings", {});
      const newSettings = { ...currentSettings, ...recordingSettings };
      store.set("appSettings", newSettings);

      console.log("[SETTINGS] Updated recording settings:", recordingSettings);
      console.log("[SETTINGS] New complete settings:", newSettings);

      // Trigger cleanup if auto cleanup settings changed
      if (
        recordingSettings.hasOwnProperty("autoCleanup") ||
        recordingSettings.hasOwnProperty("storageHistory")
      ) {
        await triggerCleanupIfNeeded();
      }

      return { success: true };
    } catch (error) {
      console.error("[SETTINGS] Failed to update recording settings:", error);
      return { success: false, error: error.message };
    }
  }
);

ipcMain.handle("app:set-start-at-login", async (event, enabled) => {
  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: false,
    });

    console.log("[APP] Start at login set to:", enabled);
    return { success: true };
  } catch (error) {
    console.error("[APP] Failed to set start at login:", error);
    return { success: false, error: error.message };
  }
});

// LLM Model management handlers
ipcMain.handle("llm:get-available-models", async () => {
  try {
    return { success: true, models: llmService.getAvailableModels() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("llm:get-status", async () => {
  try {
    const selectedModel = store.get("selectedLLMModel");
    const status = await llmService.getModelStatus(selectedModel);
    return { success: true, status };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("llm:download", async (event, modelId) => {
  console.log(`[MAIN] Received LLM download request for ${modelId}`);
  try {
    const result = await llmService.downloadModel(modelId, (progress) => {
      // Send progress updates to renderer
      if (mainWindow) {
        mainWindow.webContents.send("llm:download-progress", {
          modelId,
          ...progress,
        });
      }
    });

    if (result.success) {
      // Auto-select first downloaded model if none selected
      const selectedModel = store.get("selectedLLMModel");
      if (!selectedModel) {
        store.set("selectedLLMModel", modelId);
        console.log(`[LLM] Auto-selected first downloaded model: ${modelId}`);
      }

      // Notify completion
      if (mainWindow) {
        mainWindow.webContents.send("llm:download-complete", {
          modelId,
          success: true,
          autoSelected: !selectedModel,
        });
      }
    }

    return result;
  } catch (error) {
    console.error("[LLM] Download error:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("llm:select", async (event, modelId) => {
  try {
    const result = await llmService.loadModel(modelId);
    if (result.success) {
      store.set("selectedLLMModel", modelId);
      console.log(`[LLM] Model ${modelId} selected and loaded`);
    }
    return result;
  } catch (error) {
    console.error("[LLM] Model selection error:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("llm:delete", async (event, modelId) => {
  try {
    const result = await llmService.deleteModel(modelId);

    if (result.success) {
      // Clear selection if this was the selected model
      const selectedModel = store.get("selectedLLMModel");
      if (selectedModel === modelId) {
        store.delete("selectedLLMModel");
        console.log(`[LLM] Cleared selection for deleted model: ${modelId}`);
      }
    }

    return result;
  } catch (error) {
    console.error("[LLM] Model deletion error:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("llm:generate", async (event, prompt, options = {}) => {
  try {
    const result = await llmService.generateResponse(prompt, options);
    return result;
  } catch (error) {
    console.error("[LLM] Generation error:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("llm:get-selected", async () => {
  try {
    const selectedModel = store.get("selectedLLMModel");
    return { success: true, selectedModel };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("llm:cancel", async (event, modelId) => {
  try {
    llmService.cancelDownload(modelId);
    return { success: true };
  } catch (error) {
    console.error("[LLM] Cancel error:", error);
    return { success: false, error: error.message };
  }
});

// Test function for LLM inference
ipcMain.handle("llm:test-inference", async () => {
  try {
    const selectedModel = store.get("selectedLLMModel");
    if (!selectedModel) {
      return { success: false, error: "No LLM model selected" };
    }

    console.log(`[LLM TEST] Testing inference with model: ${selectedModel}`);

    // First, load the selected model to ensure it's ready
    console.log(`[LLM TEST] Loading model: ${selectedModel}`);
    const loadResult = await llmService.loadModel(selectedModel);

    console.log(`[LLM TEST] Load result:`, JSON.stringify(loadResult, null, 2));

    if (!loadResult || !loadResult.success) {
      console.error(`[LLM TEST] Failed to load model:`, loadResult);
      return {
        success: false,
        error: `Failed to load model ${selectedModel}: ${
          loadResult?.error || "Unknown error during model loading"
        }`,
      };
    }

    console.log(`[LLM TEST] Model loaded successfully, running inference...`);

    const testPrompt = "Hello! Please introduce yourself in one sentence.";
    const result = await llmService.generateResponse(testPrompt, {
      temperature: 0.7,
      maxTokens: 100,
    });

    console.log(
      `[LLM TEST] Inference result:`,
      JSON.stringify(result, null, 2)
    );

    if (result && result.success) {
      return {
        success: true,
        model: selectedModel,
        prompt: testPrompt,
        response: result.response,
        message: "LLM inference test completed successfully!",
      };
    } else {
      const errorMessage = result?.error || "Unknown error during inference";
      console.error(`[LLM TEST] Inference failed:`, errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  } catch (error) {
    console.error("[LLM TEST] Error during test inference:", error);
    return { success: false, error: error.message };
  }
});

// Handler to open logs folder
ipcMain.handle("open-logs-folder", async () => {
  try {
    const logsDir = app.getPath("userData");
    console.log("[LOGS] Opening logs folder:", logsDir);

    // Open the folder in the system file explorer
    await shell.openPath(logsDir);

    return { success: true, path: logsDir };
  } catch (error) {
    console.error("[LOGS] Failed to open logs folder:", error);
    return { success: false, error: error.message };
  }
});
