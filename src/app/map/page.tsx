'use client';

import WebGLMapOverlay from "@/components/WebGLMapOverlay";

export default function MapPage() {
	return (
		<div className="w-full h-screen">
			<WebGLMapOverlay />
		</div>
	);
}