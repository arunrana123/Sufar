import 'dotenv/config';

// Helper to require environment variables
const requireEnv = (key: string, options?: { prefix?: string }) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable "${key}". Please define it in worker-app/.env before building the app.`
    );
  }

  if (options?.prefix && !value.startsWith(options.prefix)) {
    throw new Error(
      `Environment variable "${key}" must start with "${options.prefix}". Received: ${value}`
    );
  }

  return value;
};

// Validate env vars
requireEnv('EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN', { prefix: 'pk.' });
const MAPBOX_DOWNLOAD_TOKEN = requireEnv('MAPBOX_DOWNLOAD_TOKEN');

const config = {
  expo: {
    name: 'worker-app',
    slug: 'worker-app',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'workerapp',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,

    // ------------------- iOS -------------------
    ios: {
      bundleIdentifier: 'com.arun22.workerapp',
      supportsTablet: true,
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'This app needs location access to show your position on the map and help customers find nearby workers.',
        NSLocationAlwaysAndWhenInUseUsageDescription:
          'This app needs location access to track your position and show your availability status to customers.',
        NSLocationAlwaysUsageDescription:
          'This app needs location access to track your position and show your availability status to customers.',

        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: ['workerapp'],
          },
        ],

        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: true,
          NSExceptionDomains: {
            localhost: {
              NSIncludesSubdomains: true,
              NSTemporaryExceptionAllowsInsecureHTTPLoads: true,
            },
            '127.0.0.1': {
              NSIncludesSubdomains: true,
              NSTemporaryExceptionAllowsInsecureHTTPLoads: true,
            },
            '192.168.1.92': {
              NSIncludesSubdomains: true,
              NSTemporaryExceptionAllowsInsecureHTTPLoads: true,
            },
            '192.168.1.88': {
              NSIncludesSubdomains: true,
              NSTemporaryExceptionAllowsInsecureHTTPLoads: true,
            },
          },
        },
      },
    },

    // ------------------- ANDROID -------------------
    android: {
      package: 'com.arun22.workerapp',
      adaptiveIcon: {
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
        backgroundColor: '#E6F4FE',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      permissions: [
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
        'ACCESS_BACKGROUND_LOCATION',
      ],
    },

    // ------------------- WEB -------------------
    web: {
      output: 'static',
      favicon: './assets/images/favicon.png',
    },

    // ------------------- PLUGINS -------------------
    plugins: [
      'expo-router',

      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission:
            'This app needs location access to track your position and show your availability status to customers.',
          locationAlwaysPermission:
            'This app needs location access to track your position and show your availability status to customers.',
          locationWhenInUsePermission:
            'This app needs location access to show your position on the map and help customers find nearby workers.',
        },
      ],

      [
        '@rnmapbox/maps',
        {
          // ✅ Correct key for SDK 54 & latest Mapbox
          RNMAPBOX_MAPS_DOWNLOAD_TOKEN: MAPBOX_DOWNLOAD_TOKEN,
        },
      ],

      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
          dark: {
            backgroundColor: '#000000',
          },
        },
      ],

      'expo-font',
      'expo-web-browser',
    ],

    // ------------------- EXPERIMENTS -------------------
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
  },
};

export default config;
