import React, { useEffect, useState } from 'react';
import { Download, Smartphone, WifiOff } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAInstallButtonProps {
  onOpenApkCenter?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ onOpenApkCenter }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const checkStandalone = () => {
      const standalone =
        window.matchMedia?.('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      setIsInstalled(Boolean(standalone));
    };
    checkStandalone();

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const handleClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
      return;
    }
    if (onOpenApkCenter) {
      onOpenApkCenter();
    }
  };

  if (isInstalled && !onOpenApkCenter) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="min-h-[38px] px-3 rounded-lg bg-[#162033] hover:bg-slate-700 border border-amber-500/50 text-amber-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
    >
      {deferredPrompt ? <Download className="w-3.5 h-3.5 text-emerald-400" /> : <Smartphone className="w-3.5 h-3.5 text-amber-400" />}
      {deferredPrompt ? 'Instalar PWA' : 'APK / PWA'}
    </button>
  );
};

export const OfflineIndicator: React.FC = () => {
  const [online, setOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 px-3 py-1 rounded-full bg-amber-950/95 border border-amber-500/70 text-[11px] font-semibold text-amber-200 inline-flex items-center gap-1.5 shadow-lg pointer-events-none"
    >
      <WifiOff className="w-3.5 h-3.5 text-amber-400" />
      <span>Modo Offline · Guardado automático en IndexedDB</span>
    </div>
  );
};
