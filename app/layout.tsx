import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Launchwing — seu produto merece aparecer",
  description: "Conteúdo para quem cria SaaS, microsaas e infoapps. Conheça a proposta da Launchwing e entre na lista de acesso antecipado.",
  robots: { index: false, follow: false },
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
