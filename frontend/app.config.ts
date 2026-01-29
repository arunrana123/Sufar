import 'dotenv/config';

const requireEnv = (key: string, options?: { prefix?: string }) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable "${key}". Please define it in frontend/.env before building the app.`
    );
  }

  if (options?.prefix && !value.startsWith(options.prefix)) {
    throw new Error(
      `Environment variable "${key}" must start with "${options.prefix}". Received value appears to be misconfigured.`
    );
  }

  return value;
};

// Validate Mapbox environment variables
requireEnv('EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN', { prefix: 'pk.' });
const MAPBOX_DOWNLOAD_TOKEN = requireEnv('MAPBOX_DOWNLOAD_TOKEN');

const config = {
  expo: {
    name: 'frontend',
    slug: 'frontend',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'frontend',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,

    ios: {
      bundleIdentifier: "com.arun22.frontend",    // ✅ Added here
      supportsTablet: true,
      infoPlist: {
        NSFaceIDUsageDescription: "Use Face ID to unlock the app and keep your account secure.",
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

    android: {
      package: "com.arun22.frontend",    // ✅ Already added
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
      usesCleartextTraffic: true,
      networkSecurityConfig: './network_security_config.xml',
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON,
    },

    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },

    plugins: [
      'expo-router',
      [
        '@rnmapbox/maps',
        {
          // ✅ Updated to use new key (RNMapboxMapsDownloadToken is deprecated)
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
        },
      ],
      'expo-web-browser',
    ],

    experiments: {
      typedRoutes: true,
    },
  },
};

export default config;
