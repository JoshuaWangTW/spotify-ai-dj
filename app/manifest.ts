import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: '#e9f4fa',
    description: 'A personal AI radio companion for Spotify Premium playback.',
    display: 'standalone',
    icons: [
      {
        sizes: '512x512',
        src: '/covers/jazz-square.png',
        type: 'image/png',
      },
    ],
    name: 'Spotify AI DJ',
    short_name: 'AI DJ',
    start_url: '/',
    theme_color: '#0284c7',
  };
}
