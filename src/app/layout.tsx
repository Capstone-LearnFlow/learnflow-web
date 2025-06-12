import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "../engine/Auth";
import PWAInstaller from "../components/PWAInstaller";

export const metadata: Metadata = {
  title: "LearnFlow",
  description: "AI-powered learning platform for research and education",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "LearnFlow",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/logo-512.png",
    apple: "/logo-512.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <meta name="application-name" content="LearnFlow" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="LearnFlow" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <meta name="msapplication-TileColor" content="#ffffff" />
        <meta name="theme-color" content="#ffffff" />

        <link rel="apple-touch-icon" href="/logo-512.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/logo-512.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/logo-512.png" />
        <link rel="apple-touch-icon" sizes="167x167" href="/logo-512.png" />

        <link rel="icon" type="image/png" sizes="32x32" href="/logo-512.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/logo-512.png" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="mask-icon" href="/logo-512.png" color="#3E935C" />
        <link rel="shortcut icon" href="/logo-512.png" />

        <meta name="twitter:card" content="summary" />
        <meta name="twitter:url" content="https://learnflow.app" />
        <meta name="twitter:title" content="LearnFlow" />
        <meta name="twitter:description" content="AI-powered learning platform for research and education" />
        <meta name="twitter:image" content="/logo-512.png" />
        <meta name="twitter:creator" content="@learnflow" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="LearnFlow" />
        <meta property="og:description" content="AI-powered learning platform for research and education" />
        <meta property="og:site_name" content="LearnFlow" />
        <meta property="og:url" content="https://learnflow.app" />
        <meta property="og:image" content="/logo-512.png" />

        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
      </head>
      <body className={`antialiased`}>
        <PWAInstaller />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
