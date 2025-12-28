// Base export - React Native Metro bundler automatically resolves to .native.tsx or .web.ts
// This file re-exports from react-native-maps directly for TypeScript resolution
// At runtime, Metro will use platform-specific files (.native.tsx, .web.ts)

// Direct export from react-native-maps - TypeScript can resolve this
// Metro bundler will override with platform-specific files at build time
export {
  default as MapView,
  Marker,
  Polyline,
  PROVIDER_GOOGLE
} from 'react-native-maps';
