import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocuMind — AI Document Q&A Assistant",
  description:
    "Chat with your PDFs, notes, and Markdown. Cited, grounded answers powered by AI.",
  authors: [{ name: "DocuMind" }],
  openGraph: {
    title: "DocuMind — AI Document Q&A Assistant",
    description: "Upload documents and ask questions. Get grounded answers with citations.",
    type: "website",
  },
  twitter: {
    card: "summary",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
