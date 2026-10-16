import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ACE — Contextual Editor",
  description: "A focused workspace for contextual editing.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  return (
    <html lang="en">
      <body>
        {publishableKey ? (
          <ClerkProvider
            publishableKey={publishableKey}
            signInFallbackRedirectUrl="/workspace/default"
            signUpFallbackRedirectUrl="/workspace/default"
            appearance={{
              theme: shadcn,
              variables: {
                colorBackground: "#171321",
                colorForeground: "#e7e9ec",
                colorMuted: "#211b2e",
                colorMutedForeground: "#a1a1aa",
                colorInput: "#100d18",
                colorInputForeground: "#f4f4f5",
                colorPrimary: "#c6f36b",
                colorPrimaryForeground: "#171321",
              },
              elements: {
                card: {
                  backgroundColor: "#171321",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  boxShadow: "0 24px 80px rgba(0, 0, 0, 0.45)",
                },
                footer: {
                  backgroundColor: "#171321",
                  borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                },
              },
            }}
          >
            {children}
          </ClerkProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
