import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ru.denta.clinic",
  appName: "Denta",
  webDir: "dist-apk/client",
  android: {
    allowMixedContent: true,
  },
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
    scheme: "Denta",
  },
  server: {
    androidScheme: "https",
    iosScheme: "https",
  },
};

export default config;
