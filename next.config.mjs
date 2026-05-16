const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://sdk.scdn.co",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "media-src 'self' blob: data: https://*.spotify.com https://*.scdn.co",
      "connect-src 'self' https://api.spotify.com https://accounts.spotify.com https://*.spotify.com wss://*.spotify.com https://api.openai.com https://api.anthropic.com",
      // Spotify Web Playback SDK loads a control iframe from sdk.scdn.co.
      // Without frame-src, browsers fall back to default-src 'self' and
      // block it — which kills the SDK and stops playback from ever starting.
      "frame-src https://sdk.scdn.co",
      "child-src https://sdk.scdn.co blob:",
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
];

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    instrumentationHook: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
