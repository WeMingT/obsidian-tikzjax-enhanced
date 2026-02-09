import { Plugin, WorkspaceWindow } from "obsidian";
import { TikzjaxPluginSettings, DEFAULT_SETTINGS } from "./settings";
import { TikzjaxSettingTab } from "./settingsTab";
import { TikzRenderer } from "./tikzRenderer";
import { TikzCache } from "./tikzCache";

// @ts-ignore
import tikzjaxJs from "inline:../tikzjax.js";

export default class TikzjaxPlugin extends Plugin {
	settings: TikzjaxPluginSettings = DEFAULT_SETTINGS;
	private renderer!: TikzRenderer;
	private cache!: TikzCache;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.cache = new TikzCache(this.settings.cacheTTL);
		this.renderer = new TikzRenderer(this.settings, this.cache);

		this.addSettingTab(new TikzjaxSettingTab(this.app, this, this.cache));

		// Support pop-out windows
		this.app.workspace.onLayoutReady(() => {
			this.loadTikZJaxAllWindows();
			this.registerEvent(
				this.app.workspace.on("window-open", (win: WorkspaceWindow) => {
					this.loadTikZJax(win.win.document);
				})
			);
		});

		this.addSyntaxHighlighting();
		this.registerTikzCodeBlock();
	}

	onunload(): void {
		this.unloadTikZJaxAllWindows();
		this.removeSyntaxHighlighting();
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.renderer.updateSettings(this.settings);
		this.cache.setTTL(this.settings.cacheTTL);
	}

	private loadTikZJax(doc: Document): void {
		const s = doc.body.createEl("script");
		s.id = "tikzjax";
		s.type = "text/javascript";
		s.innerText = tikzjaxJs;

		doc.addEventListener("tikzjax-load-finished", this.renderer.postProcessSvg);
	}

	private unloadTikZJax(doc: Document): void {
		const s = doc.getElementById("tikzjax");
		if (s) s.remove();

		doc.removeEventListener("tikzjax-load-finished", this.renderer.postProcessSvg);
	}

	private loadTikZJaxAllWindows(): void {
		for (const win of this.getAllWindows()) {
			this.loadTikZJax(win.document);
		}
	}

	private unloadTikZJaxAllWindows(): void {
		for (const win of this.getAllWindows()) {
			this.unloadTikZJax(win.document);
		}
	}

	private getAllWindows(): Window[] {
		const windows: Window[] = [];

		// Main window
		windows.push(this.app.workspace.rootSplit.win);

		// Floating (pop-out) windows
		// @ts-ignore floatingSplit is undocumented
		const floatingSplit = this.app.workspace.floatingSplit;
		if (floatingSplit) {
			floatingSplit.children.forEach((child: unknown) => {
				if (child instanceof WorkspaceWindow) {
					windows.push(child.win);
				}
			});
		}

		return windows;
	}

	private registerTikzCodeBlock(): void {
		this.registerMarkdownCodeBlockProcessor("tikz", (source, el) => {
			this.renderer.renderTikzBlock(source, el);
		});
	}

	private addSyntaxHighlighting(): void {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const cm = (window as any).CodeMirror;
		if (cm?.modeInfo) {
			cm.modeInfo.push({ name: "Tikz", mime: "text/x-latex", mode: "stex" });
		}
	}

	private removeSyntaxHighlighting(): void {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const cm = (window as any).CodeMirror;
		if (cm?.modeInfo) {
			cm.modeInfo = cm.modeInfo.filter((el: { name: string }) => el.name !== "Tikz");
		}
	}
}
