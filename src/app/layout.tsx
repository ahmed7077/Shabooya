import type { Metadata, Viewport } from 'next';
import './globals.css';
import './product.css';
export const metadata: Metadata = {
  title: 'Shabooya — Roll call, but smarter.',
  description:
    'Your personal timetable and attendance companion. Private, accurate and always close.',
  applicationName: 'Shabooya',
  openGraph: {
    title: 'Shabooya',
    description:
      'Roll call, but smarter. Know your schedule. Own your attendance.',
    type: 'website',
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Shabooya' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3f5f7' },
    { media: '(prefers-color-scheme: dark)', color: '#15181e' },
  ],
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
