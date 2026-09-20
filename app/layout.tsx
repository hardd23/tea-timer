import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SpeedInsights } from '@vercel/speed-insights/next';

export const metadata: Metadata = {
  metadataBase: new URL("https://my-tea-timer.vercel.app"),
  title: "Tea Timer",
  description: "A minimal mobile-first tea brewing timer with cooling tracking and tea wisdom.",
  authors: [{ name: "HARDD lab", url: "https://hardd-lab.vercel.app/" }],
  creator: "HARDD lab",
  openGraph: {
    title: "Tea Timer",
    description: "A minimal mobile-first tea brewing timer with cooling tracking and tea wisdom.",
    url: "/",
    siteName: "Tea Timer",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: '#f4f1e8',
};

const themeScript = `
  (() => {
    const key = 'tea-timer-theme';
    let theme = 'light';

    try {
      const savedTheme = window.localStorage.getItem(key);
      if (savedTheme === 'light' || savedTheme === 'dark') theme = savedTheme;
    } catch {}

    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#111211' : '#f4f1e8');
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="h-full antialiased" data-theme="light" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
