import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'College Athletics Consulting — Volleyball Analytics',
  description: 'Evidence-driven volleyball analytics for collegiate programs.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
