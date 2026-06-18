import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Central de Conhecimento Sittax",
  description:
    "Central de Conhecimento Sittax — base de conhecimento, cursos e atualizações dos produtos",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
