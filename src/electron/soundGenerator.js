const fs = require('fs');
const path = require('path');

// Generate a simple blip sound using sine wave
function generateBlipSound(frequency = 800, duration = 0.1, sampleRate = 44100) {
  const samples = Math.floor(sampleRate * duration);
  const buffer = new ArrayBuffer(44 + samples * 2); // WAV header + 16-bit samples
  const view = new DataView(buffer);
  
  // WAV Header
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true); // File size
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (PCM)
  view.setUint16(20, 1, true); // AudioFormat (PCM)
  view.setUint16(22, 1, true); // NumChannels (Mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample
  writeString(36, 'data');
  view.setUint32(40, samples * 2, true); // Subchunk2Size
  
  // Generate samples
  for (let i = 0; i < samples; i++) {
    // Create a blip with envelope
    const t = i / sampleRate;
    const envelope = Math.exp(-t * 10); // Exponential decay
    const sample = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.3; // Lower volume
    const intSample = Math.max(-32768, Math.min(32767, sample * 32767));
    view.setInt16(44 + i * 2, intSample, true);
  }
  
  return Buffer.from(buffer);
}

// Generate different sounds
const soundsDir = path.join(__dirname, 'assets', 'sounds');
if (!fs.existsSync(soundsDir)) {
  fs.mkdirSync(soundsDir, { recursive: true });
}

// Pill appear sound (higher pitch, quick)
const pillAppearSound = generateBlipSound(1000, 0.08);
fs.writeFileSync(path.join(soundsDir, 'pill-appear.wav'), pillAppearSound);

// Pill disappear sound (lower pitch, quick)
const pillDisappearSound = generateBlipSound(600, 0.1);
fs.writeFileSync(path.join(soundsDir, 'pill-disappear.wav'), pillDisappearSound);

console.log('Sound files generated successfully!');