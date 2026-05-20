import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ledgerpro.app',
  appName: 'LedgerPro',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
