'use client';
import { useEffect, useState } from 'react';
import { Download, Share, PlusSquare, Check } from 'lucide-react';
import { Modal } from './ui';
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export function PwaControls({
  show,
  onClose,
}: {
  show: boolean;
  onClose: () => void;
}) {
  const [install, setInstall] = useState<InstallEvent | null>(null),
    [standalone, setStandalone] = useState(false),
    [ios, setIos] = useState(false),
    [worker, setWorker] = useState<ServiceWorker | null>(null);
  useEffect(() => {
    setStandalone(
      matchMedia('(display-mode: standalone)').matches ||
        !!(navigator as Navigator & { standalone?: boolean }).standalone,
    );
    setIos(
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
    );
    const capture = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    window.addEventListener('beforeinstallprompt', capture);
    const installed = () => {
      setStandalone(true);
      setInstall(null);
    };
    window.addEventListener('appinstalled', installed);
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production')
      void navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          if (reg.waiting) setWorker(reg.waiting);
          reg.addEventListener('updatefound', () => {
            const next = reg.installing;
            next?.addEventListener('statechange', () => {
              if (
                next.state === 'installed' &&
                navigator.serviceWorker.controller
              )
                setWorker(next);
            });
          });
        })
        .catch(() => {});
    return () => {
      window.removeEventListener('beforeinstallprompt', capture);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);
  return (
    <>
      {worker && (
        <div className="update-banner" role="status">
          Update available
          <button
            className="text-button"
            onClick={() => {
              navigator.serviceWorker.addEventListener(
                'controllerchange',
                () => location.reload(),
                { once: true },
              );
              worker.postMessage({ type: 'SKIP_WAITING' });
            }}
          >
            Refresh
          </button>
        </div>
      )}
      {show && (
        <Modal
          title={
            standalone
              ? 'You’re already installed'
              : 'A little closer to your day'
          }
          onClose={() => {
            localStorage.setItem('rollcall-install-dismissed', '1');
            onClose();
          }}
        >
          {standalone ? (
            <p>
              <Check size={18} />
              rollcall is running as an installed app.
            </p>
          ) : (
            <>
              <div className="install-art">
                <Download size={32} />
              </div>
              <p>
                Keep your timetable one tap away. Install rollcall on your home
                screen.
              </p>
              {ios ? (
                <ol className="install-steps">
                  <li>
                    <Share size={18} />
                    Tap the Share button in Safari.
                  </li>
                  <li>
                    <PlusSquare size={18} />
                    Select “Add to Home Screen”.
                  </li>
                  <li>Tap “Add”. You’re all set.</li>
                </ol>
              ) : install ? (
                <button
                  className="button primary wide"
                  onClick={async () => {
                    await install.prompt();
                    const choice = await install.userChoice;
                    if (choice.outcome === 'accepted') onClose();
                    setInstall(null);
                  }}
                >
                  Install app
                </button>
              ) : (
                <p>
                  Open your browser menu and choose <strong>Install app</strong>{' '}
                  or <strong>Add to Home Screen</strong>. On iPhone, open this
                  page in Safari.
                </p>
              )}
              <p className="fine-print">
                Open the app online once to prepare it for offline use.
              </p>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
