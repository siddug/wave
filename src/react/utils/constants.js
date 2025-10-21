const DEFAULT_SETTINGS = {
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
  language: "en",
  autoStart: false,
  notifications: true,
  copyToClipboard: true,
  autoPasteToCursor: true,
  playAudio: true,
  storageHistory: "1month",
  dataRetentionDays: 30,
  autoCleanup: false,
  enhancedPrompts: true,
  llmPrompt: "",
};

const getShortcutToLabel = (shortcut) => {
  const { keyCode, flags } = shortcut;

  const labels = {
    a: 0,
    b: 11,
    c: 8,
    d: 2,
    e: 14,
    f: 3,
    g: 5,
    h: 4,
    i: 34,
    j: 38,
    k: 40,
    l: 37,
    m: 46,
    n: 45,
    o: 31,
    p: 35,
    q: 12,
    r: 15,
    s: 1,
    t: 17,
    u: 32,
    v: 9,
    w: 13,
    x: 7,
    y: 16,
    z: 6,
    LCommand: 55,
    Globe: 63,
    LCtrl: 59,
    LShift: 56,
    LAlt: 58,
    LWin: 57,
    LShift: 56,
    CapsLock: 57,
    RCommand: 54,
    RControl: 60,
    RShift: 60,
    RAlt: 61,
    RWin: 65,
    Space: 49,
    Enter: 36,
    Backspace: 51,
    Tab: 48,
    Escape: 53,
    ArrowUp: 126,
    ArrowDown: 125,
    ArrowLeft: 123,
    ArrowRight: 124,
    1: 18,
    2: 19,
    3: 20,
    4: 21,
    5: 23,
    6: 22,
    7: 26,
    8: 28,
    9: 25,
    0: 29,
    "`": 50,
    "=": 24,
    "-": 27,
    "[": 33,
    "]": 30,
    "\\": 42,
    ";": 41,
    "'": 39,
    ",": 43,
    ".": 47,
    "/": 44,
  };

  const flagLabels = {
    LCtrl: 262401,
    LShift: 131330,
    LAlt: 524576,
    LCommand: 1048840,
    RCommand: 1048848,
    RAlt: 524608,
  };

  // Find the key label for the keyCode, or return the number if not found
  let keyLabel = Object.keys(labels).find((key) => keyCode === labels[key]);
  if (!keyLabel) {
    keyLabel = keyCode;
  }

  // Find all flag labels that match
  const flagLabelStr = Object.keys(flagLabels)
    .filter((key) => (flags & flagLabels[key]) === flagLabels[key])
    .join(" + ");

  return flagLabelStr ? `${flagLabelStr} + ${keyLabel}` : `${keyLabel}`;
};

export { DEFAULT_SETTINGS, getShortcutToLabel };
