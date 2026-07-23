import type { ReactNode } from "react";

export const metadata = {
  title: "Tabernacle School Portal",
  description: "A portal for school students, staff, and parents",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
