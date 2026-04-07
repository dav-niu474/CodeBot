import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { I18nProvider } from "@/lib/i18n/use-locale";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CodeBot Agent",
  description:
    "AI-powered coding assistant inspired by Claude Code. Build, debug, and ship code with intelligent tool orchestration.",
  keywords: [
    "CodeBot",
    "AI",
    "coding assistant",
    "Claude Code",
    "agent",
    "developer tools",
  ],
  authors: [{ name: "CodeBot Team" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "CodeBot Agent",
    description:
      "AI-powered coding assistant with intelligent tool orchestration",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <I18nProvider>
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                className: "!border-border !bg-card !text-foreground",
              }}
            />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
