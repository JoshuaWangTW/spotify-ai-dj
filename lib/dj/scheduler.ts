export type DjSchedulerTrack = {
  artist: string;
  artistUris: string[];
  durationMs: number;
  id: string;
  title: string;
  uri: string;
};

export type SpotifyPlaybackStateLike = {
  duration: number;
  paused: boolean;
  position: number;
  track_window: {
    current_track?: SpotifyPlaybackTrackLike | null;
    next_tracks?: SpotifyPlaybackTrackLike[];
  };
};

type SpotifyPlaybackTrackLike = {
  artists?: Array<{ name?: string; uri?: string }>;
  duration_ms?: number;
  id?: string | null;
  name?: string;
  uri?: string;
};

export type DjCue = {
  audioUrl?: string | null;
  script: string;
  trackId: string;
};

export type DjSchedulerOptions = {
  isEnabled?: () => boolean;
  onPlaybackError?: (error: unknown) => void;
  onPrefetchError?: (error: unknown) => void;
  pauseSpotify: () => Promise<void>;
  playCue: (cue: DjCue) => Promise<void>;
  prefetchCue: (input: {
    currentTrack: DjSchedulerTrack;
    nextTrack: DjSchedulerTrack;
  }) => Promise<DjCue | null>;
  prefetchTriggerRatio?: number;
  resumeSpotify: () => Promise<void>;
};

type SchedulerState = {
  currentTrackId: string | null;
  pendingCue: DjCue | null;
  prefetchAbortController: AbortController | null;
  prefetchTriggered: boolean;
};

const DEFAULT_PREFETCH_TRIGGER_RATIO = 0.5;

function normalizeTrack(
  track: SpotifyPlaybackTrackLike | null | undefined,
): DjSchedulerTrack | null {
  const id = track?.id ?? null;
  const uri = track?.uri ?? '';

  if (!id || !uri) {
    return null;
  }

  const artists = track?.artists ?? [];

  return {
    artist: artists
      .map((artist) => artist.name)
      .filter((name): name is string => Boolean(name))
      .join(', '),
    artistUris: artists.map((artist) => artist.uri).filter((uri): uri is string => Boolean(uri)),
    durationMs: track?.duration_ms ?? 0,
    id,
    title: track?.name ?? 'Untitled track',
    uri,
  };
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_PREFETCH_TRIGGER_RATIO;
  }

  return Math.min(0.95, Math.max(0.1, value));
}

function getPlaybackProgressRatio(state: SpotifyPlaybackStateLike): number {
  if (state.duration <= 0) {
    return 0;
  }

  return Math.min(1, Math.max(0, state.position / state.duration));
}

export function buildRuleBasedDjCue(input: {
  currentTrack: DjSchedulerTrack;
  nextTrack: DjSchedulerTrack;
}): DjCue {
  const [currentPrimaryArtist] = input.currentTrack.artistUris;
  const [nextPrimaryArtist] = input.nextTrack.artistUris;
  const sameArtist =
    Boolean(currentPrimaryArtist && nextPrimaryArtist) &&
    currentPrimaryArtist === nextPrimaryArtist;

  return {
    script: sameArtist
      ? `延續剛才的聲線，讓同一位音樂人的情緒再往前走一點。`
      : `把剛才的餘韻留住，接下來換一個角度，讓節奏和空氣慢慢轉場。`,
    trackId: input.nextTrack.id,
  };
}

export class DjScheduler {
  private readonly isEnabled: () => boolean;
  private readonly onPlaybackError?: (error: unknown) => void;
  private readonly onPrefetchError?: (error: unknown) => void;
  private readonly pauseSpotify: () => Promise<void>;
  private readonly playCue: (cue: DjCue) => Promise<void>;
  private readonly prefetchCue: DjSchedulerOptions['prefetchCue'];
  private readonly prefetchTriggerRatio: number;
  private readonly resumeSpotify: () => Promise<void>;
  private state: SchedulerState = {
    currentTrackId: null,
    pendingCue: null,
    prefetchAbortController: null,
    prefetchTriggered: false,
  };

  constructor(options: DjSchedulerOptions) {
    this.isEnabled = options.isEnabled ?? (() => true);
    this.onPlaybackError = options.onPlaybackError;
    this.onPrefetchError = options.onPrefetchError;
    this.pauseSpotify = options.pauseSpotify;
    this.playCue = options.playCue;
    this.prefetchCue = options.prefetchCue;
    this.prefetchTriggerRatio = clampRatio(
      options.prefetchTriggerRatio ?? DEFAULT_PREFETCH_TRIGGER_RATIO,
    );
    this.resumeSpotify = options.resumeSpotify;
  }

  dispose(): void {
    this.state.prefetchAbortController?.abort();
    this.state = {
      currentTrackId: null,
      pendingCue: null,
      prefetchAbortController: null,
      prefetchTriggered: false,
    };
  }

  onStateChange(state: SpotifyPlaybackStateLike): void {
    if (!this.isEnabled()) {
      return;
    }

    const currentTrack = normalizeTrack(state.track_window.current_track);

    if (!currentTrack) {
      return;
    }

    if (currentTrack.id !== this.state.currentTrackId) {
      this.handleTrackChange(currentTrack.id);
    }

    const nextTrack = normalizeTrack(state.track_window.next_tracks?.[0]);

    if (!nextTrack || this.state.prefetchTriggered) {
      return;
    }

    if (getPlaybackProgressRatio(state) < this.prefetchTriggerRatio) {
      return;
    }

    this.prefetchNextCue(currentTrack, nextTrack);
  }

  private handleTrackChange(nextTrackId: string): void {
    const pendingCue = this.state.pendingCue;

    this.state.currentTrackId = nextTrackId;
    this.state.prefetchTriggered = false;
    this.state.pendingCue = null;
    this.state.prefetchAbortController?.abort();
    this.state.prefetchAbortController = null;

    if (!pendingCue || pendingCue.trackId !== nextTrackId) {
      return;
    }

    void this.playPendingCue(pendingCue);
  }

  private prefetchNextCue(currentTrack: DjSchedulerTrack, nextTrack: DjSchedulerTrack): void {
    const abortController = new AbortController();
    const currentTrackId = currentTrack.id;
    const nextTrackId = nextTrack.id;

    this.state.prefetchTriggered = true;
    this.state.prefetchAbortController?.abort();
    this.state.prefetchAbortController = abortController;

    void this.prefetchCue({ currentTrack, nextTrack })
      .then((cue) => {
        if (
          abortController.signal.aborted ||
          this.state.currentTrackId !== currentTrackId ||
          !cue ||
          cue.trackId !== nextTrackId
        ) {
          return;
        }

        this.state.pendingCue = cue;
      })
      .catch((error: unknown) => {
        if (!abortController.signal.aborted) {
          this.onPrefetchError?.(error);
        }
      });
  }

  private async playPendingCue(cue: DjCue): Promise<void> {
    try {
      await this.pauseSpotify();
      await this.playCue(cue);
    } catch (error) {
      this.onPlaybackError?.(error);
    } finally {
      try {
        await this.resumeSpotify();
      } catch (error) {
        this.onPlaybackError?.(error);
      }
    }
  }
}
