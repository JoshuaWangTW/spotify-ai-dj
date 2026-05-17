'use client';

import { useEffect, useRef } from 'react';

type WakeLockSentinelLike = {
  addEventListener(type: 'release', listener: () => void): void;
  release(): Promise<void>;
  released: boolean;
};

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request(type: 'screen'): Promise<WakeLockSentinelLike>;
  };
};

export function useScreenWakeLock(enabled: boolean) {
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function releaseWakeLock() {
      const current = wakeLockRef.current;
      wakeLockRef.current = null;

      if (current && !current.released) {
        await current.release().catch(() => undefined);
      }
    }

    async function requestWakeLock() {
      if (!enabled || typeof navigator === 'undefined' || typeof document === 'undefined') {
        await releaseWakeLock();
        return;
      }

      if (document.visibilityState !== 'visible') {
        await releaseWakeLock();
        return;
      }

      const wakeLock = (navigator as NavigatorWithWakeLock).wakeLock;

      if (!wakeLock || wakeLockRef.current) {
        return;
      }

      try {
        const sentinel = await wakeLock.request('screen');

        if (cancelled) {
          await sentinel.release().catch(() => undefined);
          return;
        }

        wakeLockRef.current = sentinel;
        sentinel.addEventListener('release', () => {
          if (wakeLockRef.current === sentinel) {
            wakeLockRef.current = null;
          }
        });
      } catch {
        // Wake Lock is optional; playback must continue without it.
      }
    }

    function handleVisibilityChange() {
      void requestWakeLock();
    }

    void requestWakeLock();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      void releaseWakeLock();
    };
  }, [enabled]);
}
