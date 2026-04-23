import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// In dev/preview, ensure no stale Service Worker keeps serving old assets.
// We unregister once per session (not on every load) to avoid fighting Vite HMR.
if (import.meta.env.DEV && "serviceWorker" in navigator) {
  const FLAG = "__sw_cleared_v1";
  if (!sessionStorage.getItem(FLAG)) {
    sessionStorage.setItem(FLAG, "1");
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      if (registrations.length === 0) return;
      Promise.all(registrations.map((r) => r.unregister()))
        .then(() => caches?.keys?.() ?? [])
        .then((cacheNames) => Promise.all((cacheNames as string[]).map((n) => caches.delete(n))))
        .then(() => window.location.reload());
    });
  }
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
