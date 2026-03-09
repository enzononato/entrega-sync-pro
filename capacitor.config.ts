import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.c7c245ac4cb04b18af87d02f182adb6c',
  appName: 'RotaScore',
  webDir: 'dist',
  server: {
    url: 'https://c7c245ac-4cb0-4b18-af87-d02f182adb6c.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  ios: {
    contentInset: 'automatic',
  },
  android: {
    backgroundColor: '#1e3a8a',
  },
};

export default config;
