import type { CapacitorConfig } from '@capacitor/cli'

/**
 * PLACEHOLDER bundle / application id.
 *
 * Change this before you create the App Store and Google Play listings.
 * It must match the app id in both stores and the four coin products.
 * Where to change it: this file (`appId`), then run `npx cap sync`.
 * See docs/STORE-RELEASE.md.
 */
export const PLACEHOLDER_APP_ID = 'com.originx1a.romangame'

const config: CapacitorConfig = {
  appId: PLACEHOLDER_APP_ID,
  appName: "Roman's Game",
  webDir: 'dist',
  ios: {
    contentInset: 'automatic',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#07122a',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: false,
    },
    StatusBar: {
      overlaysWebView: false,
      style: 'DARK',
      backgroundColor: '#07122a',
    },
  },
}

export default config
