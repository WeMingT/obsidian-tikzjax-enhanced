export function tidyTikzSource(tikzSource: string): string {
	// Remove non-breaking space characters, otherwise we get errors
	tikzSource = tikzSource.replaceAll("&nbsp;", "");

	let lines = tikzSource.split("\n");

	// Trim whitespace that is inserted when pasting in code, otherwise TikZJax complains
	lines = lines.map(line => line.trim());

	// Remove empty lines
	lines = lines.filter(line => line);

	return lines.join("\n");
}

export function injectPreamble(source: string, preamble: string): string {
	if (!preamble.trim()) return source;

	const docIndex = source.indexOf("\\begin{document}");
	if (docIndex === -1) {
		// No document environment — wrap with preamble + document
		return `${preamble}\n\\begin{document}\n${source}\n\\end{document}`;
	}

	return source.slice(0, docIndex) + preamble + "\n" + source.slice(docIndex);
}

export function extractAltText(source: string): string {
	const match = source.match(/^%\s*alt:\s*(.+)$/m);
	return match ? match[1].trim() : "TikZ diagram";
}

export function extractScale(source: string): number | null {
	const match = source.match(/^%\s*scale:\s*([\d.]+)$/m);
	return match ? parseFloat(match[1]) : null;
}
