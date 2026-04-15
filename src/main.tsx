import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const isPreviewOrIframe = (() => {
  if (typeof window === "undefined") return false;

  const hostname = window.location.hostname;
  const isPreviewHost =
    hostname.includes("id-preview--") ||
    hostname.includes("lovable.app") ||
    hostname.includes("lovableproject.com");

  try {
    return isPreviewHost || window.self !== window.top;
  } catch {
    return true;
  }
})();

if (isPreviewOrIframe && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      void registration.unregister();
    });
  });

  void caches.keys().then((cacheNames) => {
    cacheNames.forEach((cacheName) => {
      void caches.delete(cacheName);
    });
  });
}

// Capacitor plugins initialization
const initCapacitor = async () => {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      const { StatusBar, Style } = await import('@capacitor/status-bar');
      await StatusBar.setStyle({ style: Style.Light });
      await StatusBar.setBackgroundColor({ color: '#1e3a8a' });

      const { Keyboard } = await import('@capacitor/keyboard');
      Keyboard.addListener('keyboardWillShow', () => {
        document.body.classList.add('keyboard-open');
      });
      Keyboard.addListener('keyboardWillHide', () => {
        document.body.classList.remove('keyboard-open');
      });
    }
  } catch {
    // Not running in Capacitor — web context
  }
};

initCapacitor();

createRoot(document.getElementById("root")!).render(<App />);
