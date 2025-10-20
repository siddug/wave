const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
require('dotenv').config();

module.exports = {
  hooks: {
    prePackage: async () => {
      // Check if build directory exists
      const buildPath = path.join(__dirname, 'build');
      if (!fs.existsSync(buildPath)) {
        console.error('Build directory not found! Run "npm run build" first.');
        throw new Error('Build directory not found');
      }
      
      // Check if index.html exists in build
      const indexPath = path.join(buildPath, 'index.html');
      if (!fs.existsSync(indexPath)) {
        console.error('index.html not found in build directory!');
        throw new Error('Build files not found');
      }
      
      console.log('Build files found, proceeding with packaging...');
    }
  },
  packagerConfig: {
    asar: {
      unpack: '**/{node_modules/whisper-node/**,node_modules/fluent-ffmpeg/**,node_modules/ffmpeg-static/**,node_modules/@ffmpeg-installer/**,node_modules/node-llama-cpp/**,node_modules/@node-llama-cpp/**,*.node,*.dylib,*.so,*.metal,src/native/**,src/electron/assets/sounds/**}'
    },
    prune: true,
    ignore: [
      /^\/\./,
      /^\/node_modules\/\.bin/,
      /^\/src\/react\//,
      /^\/src\/assets\/.*\.iconset/,
      /^\/public\//,
      /^\/scripts\//,
      /^\/docs\//,
      /^\/test\//,
      /^\/tests\//,
      /^\/spec\//,
      /^\/\.git\//,
      /^\/\.github\//,
      /^\/\.vscode\//,
      /^\/out\//,
      /^\/dist\//,
      /\.map$/,
      /\.ts$/,
      /\.tsx$/,
      /\.jsx$/,
      /\.md$/,
      /\.yml$/,
      /\.yaml$/,
      /\.log$/,
      /\.lock$/,
      /^\/forge\.config\.js$/,
      /^\/webpack\..*\.js$/,
      /^\/rollup\..*\.js$/,
      /^\/vite\..*\.js$/,
      /^\/\.env/,
      /^\/\.eslint/,
      /^\/\.prettier/,
      /^\/jest\./,
      /^\/babel\./,
      /^\/tsconfig\./,
      /^\/tailwind\./,
      /^\/postcss\./,
      /^\/index\.html$/,
      /^\/pill\.html$/,
      /^\/create_dmg_bg\.py$/,
      /^\/buildResources\//,
    ],
    icon: './src/assets/wave-logo',
    // Code signing configuration
    osxSign: process.env.MAC_CODESIGN_IDENTITY ? {
      identity: process.env.MAC_CODESIGN_IDENTITY,
      'hardened-runtime': true,
      'gatekeeper-assess': false,
      entitlements: './entitlements.plist',
      'entitlements-inherit': './entitlements.plist',
      'signature-flags': 'library'
    } : undefined,
    // Notarization configuration (requires app-specific password)
    osxNotarize: process.env.APPLE_ID && process.env.APPLE_PASSWORD && process.env.APPLE_TEAM_ID ? {
      tool: 'notarytool',
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
      appBundleId: 'com.wave.siddg.app'
    } : undefined,
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-dmg',
      platforms: ['darwin'],
      config: {
        background: './src/assets/dmg-background.png',
        icon: './src/assets/wave-logo.icns',
        format: 'ULFO',
        overwrite: true
      }
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
  ],
};