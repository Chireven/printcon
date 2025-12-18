import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "PrintCon Enterprise",
    description: "Enterprise Printer Management Console",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className="antialiased">
                {children}
            </body>
        </html>
    );
}
