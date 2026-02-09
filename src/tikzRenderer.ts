import { Menu } from "obsidian";
import { TikzjaxPluginSettings } from "./settings";
import { TikzCache } from "./tikzCache";
import { tidyTikzSource, injectPreamble, extractAltText, extractScale } from "./tikzProcessor";
import { exportAsSvg, exportAsPng } from "./exportManager";
import { optimize } from "../svgo.browser";

const ERROR_TIMEOUT_MS = 15000;

export class TikzRenderer {
	private settings: TikzjaxPluginSettings;
	private cache: TikzCache;

	constructor(settings: TikzjaxPluginSettings, cache: TikzCache) {
		this.settings = settings;
		this.cache = cache;
	}

	updateSettings(settings: TikzjaxPluginSettings): void {
		this.settings = settings;
	}

	async renderTikzBlock(source: string, containerEl: HTMLElement): Promise<void> {
		const altText = extractAltText(source);
		const perBlockScale = extractScale(source);
		const effectiveScale = perBlockScale ?? this.settings.scaleFactor;

		// Tidy and inject preamble
		let processedSource = tidyTikzSource(source);
		if (this.settings.customPreamble) {
			processedSource = injectPreamble(processedSource, this.settings.customPreamble);
		}

		// Build UI container
		const wrapper = containerEl.createDiv({ cls: "tikz-enhanced-container" });
		wrapper.dataset.altText = altText;

		// Toolbar
		const toolbar = wrapper.createDiv({ cls: "tikz-enhanced-toolbar" });
		this.buildToolbar(toolbar, wrapper);

		// Content area — use CSS zoom (not transform) so container resizes with content
		const content = wrapper.createDiv({ cls: "tikz-enhanced-content" });
		if (effectiveScale !== 1) {
			content.style.zoom = String(effectiveScale);
		}

		// Error container (hidden by default)
		const errorContainer = wrapper.createDiv({ cls: "tikz-enhanced-error" });
		errorContainer.style.display = "none";

		// Check cache
		if (this.settings.cacheEnabled) {
			const settingsKey = JSON.stringify({
				invert: this.settings.invertColorsInDarkMode,
				preamble: this.settings.customPreamble,
				scale: effectiveScale,
			});
			const cacheKey = await TikzCache.hashKey(processedSource, settingsKey);
			const cached = await this.cache.get(cacheKey);
			if (cached) {
				this.insertSvgSafely(content, cached, altText);
				this.showCacheIndicator(toolbar);
				return;
			}

			// Store cache key for later use after rendering
			content.dataset.cacheKey = cacheKey;
		}

		// Loading spinner
		const spinner = content.createDiv({ cls: "tikz-enhanced-loading" });
		spinner.createSpan({ text: "Rendering..." });

		// Set up error detection via MutationObserver
		this.observeForErrors(content);

		// Create the TikZJax script element for rendering
		const script = content.createEl("script");
		script.setAttribute("type", "text/tikz");
		script.setAttribute("data-show-console", "true");
		script.setText(processedSource);
	}

	/**
	 * Observe the content element for TikZJax error indicators.
	 *
	 * TikZJax flow on error:
	 *   1. Replaces <script> with a loader <svg> (placeholder animation)
	 *   2. Tries to compile — on failure, replaces loader with <img src='//invalid.site/...'>
	 *   3. Does NOT fire tikzjax-load-finished
	 *
	 * Bug in previous version: the observer treated the loader SVG as "success"
	 * and disconnected itself before the error <img> appeared.
	 *
	 * Fix: only watch for <img> elements (error). Success is handled by
	 * postProcessSvg (via tikzjax-load-finished event), which marks
	 * data-tikz-pending="" to prevent the timeout from firing.
	 */
	private observeForErrors(content: HTMLElement): void {
		content.dataset.tikzPending = "true";

		const observer = new MutationObserver((mutations) => {
			if (content.dataset.tikzPending !== "true") {
				observer.disconnect();
				return;
			}

			for (const mutation of mutations) {
				for (const node of Array.from(mutation.addedNodes)) {
					// TikZJax error: replaces loader with <img src='//invalid.site/...'>
					if (node instanceof HTMLImageElement) {
						content.dataset.tikzPending = "";
						observer.disconnect();
						node.remove();

						// Remove spinner and any leftover loader elements
						const spinner = content.querySelector(".tikz-enhanced-loading");
						if (spinner) spinner.remove();

						this.showError(
							content,
							"TikZ compilation failed. Check your LaTeX source for errors.",
							"The TikZ engine could not compile this diagram. Common causes:\n" +
							"- Undefined control sequences (typos in command names)\n" +
							"- Missing \\begin{document} or \\end{document}\n" +
							"- Unsupported packages or TikZ libraries\n" +
							"- Syntax errors in TikZ commands"
						);
						return;
					}
				}
			}
		});

		observer.observe(content, { childList: true, subtree: true });

		// Timeout fallback
		setTimeout(() => {
			observer.disconnect();
			if (content.dataset.tikzPending !== "true") return;
			content.dataset.tikzPending = "";

			// If an SVG appeared, postProcessSvg handled it — don't show error
			if (content.querySelector("svg")) return;

			const spinner = content.querySelector(".tikz-enhanced-loading");
			if (spinner) spinner.remove();

			this.showError(
				content,
				"TikZ rendering timed out after " + (ERROR_TIMEOUT_MS / 1000) + " seconds.",
				"The rendering engine did not respond in time. This may indicate:\n" +
				"- An infinite loop in your TikZ code\n" +
				"- A very complex diagram that needs more time\n" +
				"- The TikZJax engine failed to initialize"
			);
		}, ERROR_TIMEOUT_MS);
	}

	postProcessSvg = async (e: Event): Promise<void> => {
		const target = e.target;
		// SVG elements are Element, not HTMLElement
		if (!(target instanceof Element)) return;

		const svgEl = target;
		let svg = new XMLSerializer().serializeToString(svgEl);

		if (this.settings.invertColorsInDarkMode) {
			svg = this.colorSVGinDarkMode(svg);
		}

		svg = this.optimizeSVG(svg);

		// Find the content container (parent of the SVG)
		const contentEl = svgEl.parentElement;
		if (!contentEl) return;

		// Mark as no longer pending (prevents timeout error from showing)
		if (contentEl instanceof HTMLElement) {
			contentEl.dataset.tikzPending = "";
		}

		// Remove loading spinner if present
		const spinner = contentEl.querySelector(".tikz-enhanced-loading");
		if (spinner) spinner.remove();

		// Get alt text from wrapper
		const wrapper = contentEl.closest(".tikz-enhanced-container");
		const altText = (wrapper instanceof HTMLElement && wrapper.dataset.altText)
			? wrapper.dataset.altText
			: "TikZ diagram";

		// Safe SVG insertion using DOMParser + importNode
		this.insertSvgSafely(contentEl, svg, altText);

		// Remove the original svgEl that TikZJax created
		if (svgEl.parentElement) {
			svgEl.remove();
		}

		// Cache the result
		if (this.settings.cacheEnabled && contentEl instanceof HTMLElement && contentEl.dataset.cacheKey) {
			await this.cache.set(contentEl.dataset.cacheKey, svg);
			const toolbar = wrapper?.querySelector(".tikz-enhanced-toolbar");
			if (toolbar instanceof HTMLElement) {
				this.showCacheIndicator(toolbar);
			}
		}
	};

	private insertSvgSafely(container: HTMLElement, svgString: string, altText: string): void {
		const parser = new DOMParser();
		const doc = parser.parseFromString(svgString, "image/svg+xml");
		const svgNode = doc.documentElement;

		// Add accessibility attributes
		svgNode.setAttribute("role", "img");
		svgNode.setAttribute("aria-label", altText);

		const imported = container.ownerDocument.importNode(svgNode, true);
		container.appendChild(imported);
	}

	private buildToolbar(toolbar: HTMLElement, wrapper: HTMLElement): void {
		// Export button
		const exportBtn = toolbar.createEl("button", {
			cls: "tikz-enhanced-btn tikz-enhanced-export-btn",
			attr: { "aria-label": "Export diagram", title: "Export diagram" },
		});
		exportBtn.setText("Export");
		exportBtn.addEventListener("click", (evt) => {
			const svgEl = wrapper.querySelector("svg");
			if (!(svgEl instanceof SVGElement)) return;

			const menu = new Menu();
			menu.addItem((item) => {
				item.setTitle("Export as SVG")
					.setIcon("file-code")
					.onClick(() => exportAsSvg(svgEl, "tikz-diagram"));
			});
			menu.addItem((item) => {
				item.setTitle("Export as PNG")
					.setIcon("image")
					.onClick(() => exportAsPng(svgEl, "tikz-diagram", this.settings.exportScale));
			});
			menu.showAtMouseEvent(evt);
		});

		// Spacer
		toolbar.createDiv({ cls: "tikz-enhanced-spacer" });

		// Zoom controls
		const zoomOut = toolbar.createEl("button", {
			cls: "tikz-enhanced-btn tikz-enhanced-zoom-btn",
			attr: { "aria-label": "Zoom out", title: "Zoom out" },
		});
		zoomOut.setText("\u2212");

		const zoomLabel = toolbar.createSpan({ cls: "tikz-enhanced-zoom-label", text: "100%" });

		const zoomIn = toolbar.createEl("button", {
			cls: "tikz-enhanced-btn tikz-enhanced-zoom-btn",
			attr: { "aria-label": "Zoom in", title: "Zoom in" },
		});
		zoomIn.setText("+");

		let currentZoom = 1;
		const zoomSteps = [0.5, 0.75, 1, 1.5, 2];

		const updateZoom = (zoom: number) => {
			currentZoom = zoom;
			const contentEl = wrapper.querySelector(".tikz-enhanced-content") as HTMLElement | null;
			if (contentEl) {
				// Use CSS zoom (not transform) — zoom changes layout size,
				// so the container border expands with the content
				contentEl.style.zoom = zoom === 1 ? "" : String(zoom);
			}
			zoomLabel.setText(`${Math.round(zoom * 100)}%`);

			// Update cursor class
			if (zoom > 1) {
				wrapper.classList.add("tikz-enhanced-zoom-2");
				wrapper.classList.remove("tikz-enhanced-zoom-1");
			} else {
				wrapper.classList.add("tikz-enhanced-zoom-1");
				wrapper.classList.remove("tikz-enhanced-zoom-2");
			}
		};

		zoomIn.addEventListener("click", () => {
			const idx = zoomSteps.indexOf(currentZoom);
			if (idx < zoomSteps.length - 1) {
				updateZoom(zoomSteps[idx + 1]);
			} else if (idx === -1) {
				const next = zoomSteps.find(s => s > currentZoom);
				if (next) updateZoom(next);
			}
		});

		zoomOut.addEventListener("click", () => {
			const idx = zoomSteps.indexOf(currentZoom);
			if (idx > 0) {
				updateZoom(zoomSteps[idx - 1]);
			} else if (idx === -1) {
				const prev = [...zoomSteps].reverse().find(s => s < currentZoom);
				if (prev) updateZoom(prev);
			}
		});

		// Click-to-toggle zoom on content area
		wrapper.addEventListener("click", (evt) => {
			const target = evt.target;
			// Ignore clicks on toolbar
			if (target instanceof Element && target.closest(".tikz-enhanced-toolbar")) return;
			// Toggle zoom when clicking on content/SVG area
			if (target instanceof SVGElement || target instanceof SVGGraphicsElement ||
				(target instanceof Element && target.closest(".tikz-enhanced-content"))) {
				if (currentZoom === 1) {
					updateZoom(2);
				} else {
					updateZoom(1);
				}
			}
		});
	}

	private showCacheIndicator(toolbar: HTMLElement): void {
		if (!this.settings.showCacheIndicator) return;
		if (toolbar.querySelector(".tikz-enhanced-cache-indicator")) return;
		const indicator = toolbar.createSpan({
			cls: "tikz-enhanced-cache-indicator",
			text: "cached",
			attr: { title: "Loaded from cache" },
		});
		// Insert before spacer to appear on the left side
		const spacer = toolbar.querySelector(".tikz-enhanced-spacer");
		if (spacer) {
			toolbar.insertBefore(indicator, spacer);
		}
	}

	showError(container: HTMLElement, message: string, details?: string): void {
		if (!this.settings.showErrorMessages) return;

		// container may be the content div — find the wrapper
		const wrapper = container.closest(".tikz-enhanced-container") ?? container.parentElement;
		const errorEl = wrapper?.querySelector(".tikz-enhanced-error") as HTMLElement | null;
		if (!errorEl) return;

		errorEl.style.display = "";
		errorEl.empty();

		// Header
		const header = errorEl.createDiv({ cls: "tikz-enhanced-error-header" });
		const toggle = header.createSpan({ cls: "tikz-enhanced-error-toggle", text: "\u25B6" });
		header.createSpan({ text: " TikZ rendering error" });

		// Message
		const msgEl = errorEl.createDiv({ cls: "tikz-enhanced-error-message" });
		msgEl.setText(message);

		// Collapsible details
		if (details) {
			const detailsEl = errorEl.createDiv({ cls: "tikz-enhanced-error-details" });
			detailsEl.style.display = "none";
			detailsEl.createEl("pre").setText(details);

			header.addEventListener("click", () => {
				const isHidden = detailsEl.style.display === "none";
				detailsEl.style.display = isHidden ? "" : "none";
				toggle.setText(isHidden ? "\u25BC" : "\u25B6");
			});
			header.style.cursor = "pointer";
		}
	}

	private colorSVGinDarkMode(svg: string): string {
		return svg
			.replaceAll(/("#000"|"#000000"|"black"|'#000'|'#000000'|'black')/g, `"currentColor"`)
			.replaceAll(/("#fff"|"#ffffff"|"white"|'#fff'|'#ffffff'|'white')/g, `"var(--background-primary)"`);
	}

	private optimizeSVG(svg: string): string {
		return (optimize(svg, {
			plugins: [
				{
					name: "preset-default",
					params: {
						overrides: {
							cleanupIDs: false,
						},
					},
				},
			],
		}) as { data: string }).data;
	}
}
