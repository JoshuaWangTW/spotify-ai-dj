// components/mobile/MobileShell.tsx
// Root mobile shell. Manages tab state, mini-player, modal stack, and wraps
// everything in RadioProvider so screens can call startSession/stopSession.
'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import BottomTabs, { type TabId } from './BottomTabs';
import MiniPlayer from './MiniPlayer';
import { RadioProvider, useRadio } from './RadioContext';
import { useSpotifyWebPlayback } from '../player/useSpotifyWebPlayback';

import ForYouScreen from './screens/ForYouScreen';
import ExploreScreen from './screens/ExploreScreen';
import LibraryScreen from './screens/LibraryScreen';
import ProfileScreen from './screens/ProfileScreen';

import NowPlayingModal from './modals/NowPlayingModal';
import StartSessionSheet from './modals/StartSessionSheet';
import CommentaryModal from './modals/CommentaryModal';
import ChatSheet from './modals/ChatSheet';
import { ASSISTANT_CUSTOM_MODE, type DjMode } from './modes';

const AUTO_TICK_INTERVAL_MS = 30_000;
const AUTO_TICK_QUEUE_THRESHOLD = 1;

export type SessionUser = {
  displayName: string;
  spotifyConnected: boolean;
};

type Props = {
  sessionUser: SessionUser | null;
  authBanner?: ReactNode;
};

export default function MobileShell(props: Props) {
  return (
    <RadioProvider>
      <MobileShellInner {...props} />
    </RadioProvider>
  );
}

function MobileShellInner({ sessionUser, authBanner }: Props) {
  const [tab, setTab] = useState<TabId>('foryou');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Modal stack
  const [showNowPlaying, setShowNowPlaying] = useState(false);
  const [showCommentary, setShowCommentary] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatInitialPrompt, setChatInitialPrompt] = useState<string | undefined>(undefined);
  const [startSessionMode, setStartSessionMode] = useState<DjMode | null>(null);
  const autoTickInFlightRef = useRef(false);

  // Spotify playback (single hook instance at the shell level)
  const playback = useSpotifyWebPlayback();
  const { segment, session: radioSession, setDraftPrompt, tickSession } = useRadio();

  // Reset scroll on tab change
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [tab]);

  useEffect(() => {
    if (radioSession?.status !== 'active') {
      return undefined;
    }

    const interval = window.setInterval(() => {
      if (autoTickInFlightRef.current) {
        return;
      }

      autoTickInFlightRef.current = true;

      void (async () => {
        try {
          const response = await fetch('/api/spotify/queue-status', {
            cache: 'no-store',
          });

          if (!response.ok) {
            return;
          }

          const body = (await response.json()) as { queueCount?: unknown };

          if (typeof body.queueCount === 'number' && body.queueCount <= AUTO_TICK_QUEUE_THRESHOLD) {
            await tickSession();
          }
        } finally {
          autoTickInFlightRef.current = false;
        }
      })();
    }, AUTO_TICK_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [radioSession?.id, radioSession?.status, tickSession]);

  const openNowPlaying = useCallback(() => setShowNowPlaying(true), []);
  const closeNowPlaying = useCallback(() => setShowNowPlaying(false), []);
  const openCommentary = useCallback(() => setShowCommentary(true), []);
  const closeCommentary = useCallback(() => setShowCommentary(false), []);

  const openChat = useCallback((initial?: string) => {
    setChatInitialPrompt(initial);
    setShowChat(true);
  }, []);
  const closeChat = useCallback(() => setShowChat(false), []);

  const pickMode = useCallback((mode: DjMode) => setStartSessionMode(mode), []);
  const closeStartSheet = useCallback(() => setStartSessionMode(null), []);
  const handleSessionStarted = useCallback(() => {
    setStartSessionMode(null);
    setShowNowPlaying(true);
  }, []);

  // When ChatSheet hands off a radio prompt, open StartSessionSheet
  // in category-picking mode instead of forcing Jazz.
  const handleChatHandoff = useCallback(
    (prompt: string) => {
      setDraftPrompt(prompt);
      setShowChat(false);
      setStartSessionMode(ASSISTANT_CUSTOM_MODE);
    },
    [setDraftPrompt],
  );

  const hasSomethingPlaying = !!playback.track || !!segment;

  return (
    <div
      className="liquid-shell relative min-h-screen text-slate-700"
      style={{
        background:
          'radial-gradient(circle at 18% 8%, rgba(186, 230, 253, 0.45), transparent 38rem),' +
          'radial-gradient(circle at 82% 78%, rgba(148, 197, 234, 0.32), transparent 36rem),' +
          'linear-gradient(150deg, #dceffb 0%, #e9f4fa 44%, #f3f9fd 100%)',
      }}
    >
      {authBanner ? <div className="mx-auto max-w-md px-4 pt-3">{authBanner}</div> : null}

      <div
        ref={scrollRef}
        className="mx-auto max-w-md overflow-y-auto px-0 pb-[200px] pt-4"
        style={{ minHeight: '100vh' }}
      >
        {tab === 'foryou' && (
          <ForYouScreen
            sessionUser={sessionUser}
            onPickMode={pickMode}
            onOpenNowPlaying={openNowPlaying}
          />
        )}
        {tab === 'explore' && <ExploreScreen onPickMode={pickMode} onOpenChat={openChat} />}
        {tab === 'library' && <LibraryScreen onOpenNowPlaying={openNowPlaying} />}
        {tab === 'profile' && <ProfileScreen sessionUser={sessionUser} />}
      </div>

      {hasSomethingPlaying && (
        <MiniPlayer
          track={playback.track}
          playing={playback.isPlaying}
          onTogglePlay={() => void playback.runPlayerCommand('toggle')}
          onExpand={openNowPlaying}
        />
      )}

      <BottomTabs active={tab} onSelect={setTab} />

      {showNowPlaying && (
        <NowPlayingModal
          playback={playback}
          onClose={closeNowPlaying}
          onOpenCommentary={openCommentary}
        />
      )}

      {showCommentary && <CommentaryModal track={playback.track} onClose={closeCommentary} />}

      {startSessionMode && (
        <StartSessionSheet
          mode={startSessionMode}
          onClose={closeStartSheet}
          onStarted={handleSessionStarted}
        />
      )}

      {showChat && (
        <ChatSheet
          onClose={closeChat}
          initialPrompt={chatInitialPrompt}
          onUseRadioPrompt={handleChatHandoff}
        />
      )}
    </div>
  );
}
