import { useEffect, useRef, useState } from "react";
import { registerSW } from "virtual:pwa-register";

/** Updates remain waiting until the user explicitly accepts after saving. */
export function usePWA() {
  const [offlineReady, setOfflineReady] = useState(false);
  const [needRefresh, setNeedRefresh] = useState(false);
  const update = useRef<((reloadPage?: boolean) => Promise<void>) | undefined>(undefined);
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    let mounted = true;
    update.current = registerSW({
      immediate: true,
      onOfflineReady() { if (mounted) setOfflineReady(true); },
      onNeedRefresh() { if (mounted) setNeedRefresh(true); },
      onRegisteredSW(_url, registration) {
        // An existing active controller has already completed its precache install.
        if (mounted && registration?.active && navigator.serviceWorker.controller) setOfflineReady(true);
      },
      onRegisterError(error) { console.warn("No se pudo preparar el modo sin conexión", error); },
    });
    return () => { mounted = false; };
  }, []);
  return {
    offlineReady,
    needRefresh,
    applyUpdate: async () => { await update.current?.(true); },
    dismiss: () => { setNeedRefresh(false); setOfflineReady(false); },
  };
}
