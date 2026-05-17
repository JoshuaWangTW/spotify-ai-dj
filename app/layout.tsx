import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  description: 'AI DJ for classical and jazz music with Spotify integration',
  manifest: '/manifest.webmanifest',
  title: 'Spotify AI DJ',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
