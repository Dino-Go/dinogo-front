import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import '@mysten/dapp-kit/dist/index.css';

// Providers
import { Providers } from './components/providers';

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Suimming WebGL Map",
	description: "Interactive WebGL map overlay with Three.js - optimized for mobile",
	manifest: "/manifest.json",
	appleWebApp: {
		capable: true,
		statusBarStyle: "default",
		title: "Suimming Map",
	},
	robots: "index, follow",
	openGraph: {
		title: "Suimming WebGL Map",
		description: "Interactive WebGL map overlay with Three.js",
		type: "website",
	},
};

export const viewport = {
	width: "device-width",
	initialScale: 1,
	maximumScale: 1,
	userScalable: false,
	themeColor: "#3b82f6",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<head>
				<link rel="manifest" href="/manifest.json" />
				<meta name="mobile-web-app-capable" content="yes" />
				<meta name="apple-mobile-web-app-capable" content="yes" />
				<meta name="apple-mobile-web-app-status-bar-style" content="default" />
				<meta name="apple-mobile-web-app-title" content="Suimming Map" />
				<meta name="msapplication-TileColor" content="#3b82f6" />
				<meta name="msapplication-tap-highlight" content="no" />

				<link rel="apple-touch-icon" href="/icon-192x192.png" />
				<link rel="apple-touch-icon" sizes="152x152" href="/icon-192x192.png" />
				<link rel="apple-touch-icon" sizes="180x180" href="/icon-192x192.png" />
				<link rel="apple-touch-icon" sizes="167x167" href="/icon-192x192.png" />

				<link rel="icon" type="image/png" sizes="32x32" href="/icon-192x192.png" />
				<link rel="icon" type="image/png" sizes="16x16" href="/icon-192x192.png" />
				<link rel="shortcut icon" href="/favicon.ico" />

				<meta name="apple-mobile-web-app-title" content="Suimming Map" />
				<link rel="apple-touch-startup-image" href="/icon-512x512.png" />
			</head>
			<body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
