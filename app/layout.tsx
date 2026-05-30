import type { Metadata } from 'next';
import './globals.css';
import NoImageDrag from '@/components/NoImageDrag';

export const metadata: Metadata = {
  title: 'Avatars',
  description: "View any Roblox player's avatar, accessories, and inventory.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <NoImageDrag />
        {children}
      </body>
    </html>
  );
}
