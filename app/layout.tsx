import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mercadinho Alameda das Arvores | PDV",
  description: "Sistema PDV profissional para mercado"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
