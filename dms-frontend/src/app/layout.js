// src/app/layout.js
import '../styles/globals.css';
import '../styles/layout.css';
import '../styles/components.css';
import { Providers } from './providers';

export const metadata = {
  title: 'DMS — Digital Signage Management',
  description: 'Multi-tenant digital signage control system',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
