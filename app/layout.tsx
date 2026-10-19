import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://amcyberworld.com'),
  title: {
    default: 'AMCYBERWORLD | Citizenship by Investment Advisory',
    template: '%s | AMCYBERWORLD',
  },
  description: 'Compare citizenship by investment programmes and begin a secure, guided eligibility review.',
  openGraph: {
    title: 'AMCYBERWORLD | Citizenship by Investment Advisory',
    url: 'https://amcyberworld.com',
    description: 'Citizenship by investment, handled with clarity.',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'AMCYBERWORLD citizenship by investment advisory' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AMCYBERWORLD | Citizenship by Investment Advisory',
    description: 'Citizenship by investment, handled with clarity.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
