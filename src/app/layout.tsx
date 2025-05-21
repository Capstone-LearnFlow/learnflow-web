import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../engine/Auth";

export const metadata: Metadata = {
  title: "LearnFlow",
  description: "",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`antialiased`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
