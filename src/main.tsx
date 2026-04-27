import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Service Worker: registra em produção com auto-update.
// Em iframes/previews da Lovable, desregistra para evitar cache antigo no editor.
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  typeof window !== "undefined" &&
  (window.location.hostname.includes("id-preview--") ||
    window.location.hostname.includes("lovableproject.com"));

if ("serviceWorker" in navigator) {
  if (isInIframe || isPreviewHost || import.meta.env.DEV) {
    // Limpa qualquer SW que tenha sobrado em contextos de preview/dev
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    });
    if (typeof caches !== "undefined") {
      caches.keys().then((names) => names.forEach((n) => caches.delete(n)));
    }
  } else {
    // Produção: registra o SW gerado pelo vite-plugin-pwa.
    // Quando uma nova versão for detectada, recarrega a página automaticamente.
    import("virtual:pwa-register")
      .then(({ registerSW }) => {
        const updateSW = registerSW({
          immediate: true,
          onNeedRefresh() {
            updateSW(true);
          },
          onRegisteredSW(_swUrl, registration) {
            // Verifica updates periodicamente (a cada 30 min)
            if (registration) {
              setInterval(() => registration.update(), 30 * 60 * 1000);
            }
          },
        });

        // Recarrega quando o novo SW assume o controle
        let refreshing = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });
      })
      .catch(() => {
        // Plugin PWA indisponível — segue sem SW
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
