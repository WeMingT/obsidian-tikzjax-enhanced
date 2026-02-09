export interface TikzjaxPluginSettings {
	// Appearance
	invertColorsInDarkMode: boolean;
	scaleFactor: number;
	// LaTeX
	customPreamble: string;
	// Rendering
	showErrorMessages: boolean;
	// Cache
	cacheEnabled: boolean;
	cacheTTL: number; // minutes
	showCacheIndicator: boolean;
	// Export
	exportFormat: 'svg' | 'png';
	exportScale: number;
	// Debug
	debugMode: boolean;
}

export const DEFAULT_SETTINGS: TikzjaxPluginSettings = {
	invertColorsInDarkMode: true,
	scaleFactor: 1,
	customPreamble: '',
	showErrorMessages: true,
	cacheEnabled: true,
	cacheTTL: 1440, // 24 hours
	showCacheIndicator: true,
	exportFormat: 'svg',
	exportScale: 2,
	debugMode: false,
};
