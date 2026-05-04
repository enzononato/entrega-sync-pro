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
    window.location.hostname.includes("lovableproject.com") ||
    window.location.hostname.includes("lovable.app"));

if ("serviceWorker" in navigator) {
  if (isInIframe || isPreviewHost || import.meta.env.DEV) {
    // Limpa qualquer SW/cache que tenha sobrado em contextos de preview/dev.
    // Se encontrarmos algo, fazemos um reload forçado UMA vez para garantir
    // que o usuário veja a versão mais recente (não a cacheada pelo SW antigo).
    (async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        const cacheNames =
          typeof caches !== "undefined" ? await caches.keys() : [];
        const hadStaleSW = regs.length > 0 || cacheNames.length > 0;

        await Promise.all(regs.map((r) => r.unregister()));
        if (cacheNames.length > 0) {
          await Promise.all(cacheNames.map((n) => caches.delete(n)));
        }

        // Evita loop de reload usando sessionStorage, mas invalida a URL do preview.
        const RELOAD_KEY = "__sw_cleanup_reloaded_v3__";
        const url = new URL(window.location.href);
        if (!url.searchParams.has("previewNoCache")) {
          url.searchParams.set("previewNoCache", Date.now().toString());
          window.history.replaceState(null, "", url.toString());
        }
        if (hadStaleSW && !sessionStorage.getItem(RELOAD_KEY)) {
          sessionStorage.setItem(RELOAD_KEY, "1");
          window.location.replace(url.toString());
        }
      } catch {
        // ignore
      }
    })();
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
