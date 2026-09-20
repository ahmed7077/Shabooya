import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Shabooya',
    short_name: 'Shabooya',
    description:
      'Roll call, but smarter. Your personal timetable and attendance.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f3f5f7',
    theme_color: '#2860c5',
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
