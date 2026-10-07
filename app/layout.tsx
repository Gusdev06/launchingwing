import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Launchwing: do seu produto ao próximo conteúdo",
  description: "Do link do seu produto a posts para o seu público. Conheça a proposta da Launchwing para apps e SaaS e entre na lista de acesso antecipado.",
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
