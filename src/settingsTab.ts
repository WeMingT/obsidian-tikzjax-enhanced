import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import type TikzjaxPlugin from "./main";
import type { TikzCache } from "./tikzCache";

export class TikzjaxSettingTab extends PluginSettingTab {
	private plugin: TikzjaxPlugin;
	private cache: TikzCache;

	constructor(app: App, plugin: TikzjaxPlugin, cache: TikzCache) {
		super(app, plugin);
		this.plugin = plugin;
		this.cache = cache;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// --- Appearance ---
		new Setting(containerEl).setName("Appearance").setHeading();

		new Setting(containerEl)
			.setName("Invert dark colors in dark mode")
			.setDesc("Invert dark colors in diagrams (e.g. axes, arrows) when in dark mode, so that they are visible.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.invertColorsInDarkMode).onChange(async (value) => {
					this.plugin.settings.invertColorsInDarkMode = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Default scale factor")
			.setDesc("Default zoom level for diagrams (1 = 100%). Can be overridden per block with % scale: N.")
			.addSlider((slider) =>
				slider
					.setLimits(0.5, 3, 0.25)
					.setValue(this.plugin.settings.scaleFactor)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.scaleFactor = value;
						await this.plugin.saveSettings();
					})
			);

		// --- LaTeX ---
		new Setting(containerEl).setName("LaTeX").setHeading();

		new Setting(containerEl)
			.setName("Custom preamble")
			.setDesc("LaTeX commands to insert before \\begin{document}. Use for \\usepackage, \\newcommand, \\usetikzlibrary, etc.")
			.addTextArea((text) =>
				text
					.setPlaceholder("\\usetikzlibrary{arrows}\n\\newcommand{\\R}{\\mathbb{R}}")
					.setValue(this.plugin.settings.customPreamble)
					.onChange(async (value) => {
						this.plugin.settings.customPreamble = value;
						await this.plugin.saveSettings();
					})
			);

		// --- Rendering ---
		new Setting(containerEl).setName("Rendering").setHeading();

		new Setting(containerEl)
			.setName("Show error messages")
			.setDesc("Display structured error messages when TikZ rendering fails.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.showErrorMessages).onChange(async (value) => {
					this.plugin.settings.showErrorMessages = value;
					await this.plugin.saveSettings();
				})
			);

		// --- Cache ---
		new Setting(containerEl).setName("Cache").setHeading();

		new Setting(containerEl)
			.setName("Enable cache")
			.setDesc("Cache rendered SVGs to avoid re-rendering unchanged diagrams.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.cacheEnabled).onChange(async (value) => {
					this.plugin.settings.cacheEnabled = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Cache TTL (minutes)")
			.setDesc("How long cached SVGs remain valid. Default: 1440 (24 hours).")
			.addText((text) =>
				text
					.setPlaceholder("1440")
					.setValue(String(this.plugin.settings.cacheTTL))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num > 0) {
							this.plugin.settings.cacheTTL = num;
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName("Show cache indicator")
			.setDesc("Display a small 'cached' badge on diagrams loaded from cache.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.showCacheIndicator).onChange(async (value) => {
					this.plugin.settings.showCacheIndicator = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Clear cached SVGs")
			.setDesc("Force all diagrams to be re-rendered from scratch.")
			.addButton((button) =>
				button
					.setIcon("trash")
					.setTooltip("Clear cached SVGs")
					.onClick(async () => {
						try {
							await this.cache.clear();
							new Notice("TikZJax Enhanced: successfully cleared cached SVGs.", 3000);
						} catch (err) {
							console.error("TikZJax Enhanced: failed to clear cache", err);
							new Notice("Failed to clear cache.", 3000);
						}
					})
			);

		// --- Export ---
		new Setting(containerEl).setName("Export").setHeading();

		new Setting(containerEl)
			.setName("Default export format")
			.setDesc("Default format when exporting diagrams.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("svg", "SVG")
					.addOption("png", "PNG")
					.setValue(this.plugin.settings.exportFormat)
					.onChange(async (value) => {
						this.plugin.settings.exportFormat = value as "svg" | "png";
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("PNG export scale")
			.setDesc("Resolution multiplier for PNG exports. Higher values produce sharper images.")
			.addSlider((slider) =>
				slider
					.setLimits(1, 4, 0.5)
					.setValue(this.plugin.settings.exportScale)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.exportScale = value;
						await this.plugin.saveSettings();
					})
			);

		// --- Debug ---
		new Setting(containerEl).setName("Debug").setHeading();

		new Setting(containerEl)
			.setName("Debug mode")
			.setDesc("Enable verbose logging to the developer console.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.debugMode).onChange(async (value) => {
					this.plugin.settings.debugMode = value;
					await this.plugin.saveSettings();
				})
			);
	}
}
