const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add sourceExts for platform-specific files
config.resolver.sourceExts.push('web.ts', 'web.tsx', 'web.js', 'web.jsx');

// Note: react-native-maps is handled conditionally in code (web vs native)
// No need to blockList since we use platform-specific imports

module.exports = config;
