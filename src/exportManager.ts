export function exportAsSvg(svgEl: SVGElement, filename: string): void {
	const serializer = new XMLSerializer();
	const svgString = serializer.serializeToString(svgEl);
	const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
	downloadBlob(blob, filename + ".svg");
}

export function exportAsPng(svgEl: SVGElement, filename: string, scale: number): void {
	const serializer = new XMLSerializer();
	const svgString = serializer.serializeToString(svgEl);
	const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
	const url = URL.createObjectURL(svgBlob);

	const img = new Image();
	img.onload = () => {
		const canvas = document.createElement("canvas");
		canvas.width = img.naturalWidth * scale;
		canvas.height = img.naturalHeight * scale;
		const ctx = canvas.getContext("2d");
		if (!ctx) {
			URL.revokeObjectURL(url);
			return;
		}
		ctx.scale(scale, scale);
		ctx.drawImage(img, 0, 0);
		URL.revokeObjectURL(url);

		canvas.toBlob((blob) => {
			if (blob) {
				downloadBlob(blob, filename + ".png");
			}
		}, "image/png");
	};
	img.onerror = () => {
		URL.revokeObjectURL(url);
		console.error("TikZJax Enhanced: failed to render SVG to PNG");
	};
	img.src = url;
}

function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
