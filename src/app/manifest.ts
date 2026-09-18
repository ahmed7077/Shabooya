import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'rollcall — Personal attendance',
    short_name: 'rollcall',
    description: 'Your day, in focus. Personal attendance and timetable.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f8f9f6',
    theme_color: '#176958',
    orientation: 'portrait-primary',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
