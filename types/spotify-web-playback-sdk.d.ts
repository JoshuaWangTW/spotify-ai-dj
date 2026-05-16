type SpotifyWebPlaybackError = {
  message: string;
};

type SpotifyWebPlaybackImage = {
  height: number | null;
  url: string;
  width: number | null;
};

type SpotifyWebPlaybackArtist = {
  name: string;
  uri: string;
};

type SpotifyWebPlaybackTrack = {
  album: {
    images: SpotifyWebPlaybackImage[];
    name: string;
    uri: string;
  };
  artists: SpotifyWebPlaybackArtist[];
  duration_ms: number;
  id: string | null;
  name: string;
  uri: string;
};

type SpotifyWebPlaybackState = {
  duration: number;
  paused: boolean;
  position: number;
  track_window: {
    current_track: SpotifyWebPlaybackTrack;
    next_tracks?: SpotifyWebPlaybackTrack[];
    previous_tracks?: SpotifyWebPlaybackTrack[];
  };
};

type SpotifyWebPlaybackReadyEvent = {
  device_id: string;
};

type SpotifyWebPlaybackPlayer = {
  activateElement(): Promise<void>;
  addListener(
    event: 'ready' | 'not_ready',
    callback: (event: SpotifyWebPlaybackReadyEvent) => void,
  ): boolean;
  addListener(
    event: 'initialization_error' | 'authentication_error' | 'account_error' | 'playback_error',
    callback: (error: SpotifyWebPlaybackError) => void,
  ): boolean;
  addListener(
    event: 'player_state_changed',
    callback: (state: SpotifyWebPlaybackState | null) => void,
  ): boolean;
  connect(): Promise<boolean>;
  disconnect(): void;
  getCurrentState(): Promise<SpotifyWebPlaybackState | null>;
  nextTrack(): Promise<void>;
  pause(): Promise<void>;
  previousTrack(): Promise<void>;
  resume(): Promise<void>;
  togglePlay(): Promise<void>;
};

type SpotifyWebPlaybackPlayerConstructor = new (options: {
  getOAuthToken(callback: (token: string) => void): void;
  name: string;
  volume?: number;
}) => SpotifyWebPlaybackPlayer;

interface Window {
  onSpotifyWebPlaybackSDKReady?: () => void;
  Spotify?: {
    Player: SpotifyWebPlaybackPlayerConstructor;
  };
}
