import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ledgerpro.app',
  appName: 'LedgerPro',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },

  plugins: {
    SplashScreen: {
      // Show splash for 1.5s then auto-hide
      launchShowDuration: 1500,
      launchAutoHide: true,
      // Match the dark background in styles.xml
      backgroundColor: '#111827',
      // Show spinner while web view loads
      showSpinner: false,
      // Android specific
      androidSpinnerStyle: 'small',
      spinnerColor: '#3B82F6',
      // Splash is full screen
      splashFullScreen: true,
      splashImmersive: true,
    },

    StatusBar: {
      // Overlay the status bar (edge-to-edge)
      overlaysWebView: true,
      // Light content (white icons) for dark background
      style: 'DARK',
      backgroundColor: '#00000000', // Transparent
    },

    Keyboard: {
      // Push content up when keyboard opens (not overlay it)
      // 'native' = use Android's native soft input resize mode
      resize: 'native' as any,
      resizeOnFullScreen: true,
    },
  },

  android: {
    // Allow mixed content for local assets
    allowMixedContent: false,
    // Capture input for hardware back button
    captureInput: false,
    // Web view background color while loading
    backgroundColor: '#111827',
    // Minimum API level
    minWebViewVersion: 60,
  },
};

export default config;

