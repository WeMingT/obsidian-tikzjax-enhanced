import * as localForage from "localforage";

interface CacheEntry {
	svg: string;
	timestamp: number;
}

export class TikzCache {
	private memoryCache: Map<string, CacheEntry> = new Map();
	private store: typeof localForage | null = null;
	private ttl: number; // ms

	constructor(ttlMinutes: number) {
		this.ttl = ttlMinutes * 60 * 1000;
		try {
			localForage.config({ name: 'TikzJaxEnhanced', storeName: 'svgImages' });
			this.store = localForage;
		} catch {
			// localForage not available (e.g. mobile) — memory-only cache
		}
	}

	setTTL(ttlMinutes: number): void {
		this.ttl = ttlMinutes * 60 * 1000;
	}

	async get(key: string): Promise<string | null> {
		// Check memory first
		const mem = this.memoryCache.get(key);
		if (mem) {
			if (Date.now() - mem.timestamp < this.ttl) {
				return mem.svg;
			}
			this.memoryCache.delete(key);
		}

		// Check persistent storage
		if (this.store) {
			try {
				const entry = await this.store.getItem<CacheEntry>(key);
				if (entry && Date.now() - entry.timestamp < this.ttl) {
					this.memoryCache.set(key, entry);
					return entry.svg;
				}
				if (entry) {
					await this.store.removeItem(key);
				}
			} catch {
				// ignore storage errors
			}
		}

		return null;
	}

	async set(key: string, svg: string): Promise<void> {
		const entry: CacheEntry = { svg, timestamp: Date.now() };
		this.memoryCache.set(key, entry);

		if (this.store) {
			try {
				await this.store.setItem(key, entry);
			} catch {
				// ignore storage errors
			}
		}
	}

	async clear(): Promise<void> {
		this.memoryCache.clear();
		if (this.store) {
			try {
				await this.store.clear();
			} catch {
				// ignore storage errors
			}
		}
	}

	async clearExpired(): Promise<void> {
		const now = Date.now();

		// Memory cache
		for (const [key, entry] of this.memoryCache) {
			if (now - entry.timestamp >= this.ttl) {
				this.memoryCache.delete(key);
			}
		}

		// Persistent storage
		if (this.store) {
			try {
				const keys = await this.store.keys();
				for (const key of keys) {
					const entry = await this.store.getItem<CacheEntry>(key);
					if (entry && now - entry.timestamp >= this.ttl) {
						await this.store.removeItem(key);
					}
				}
			} catch {
				// ignore storage errors
			}
		}
	}

	static async hashKey(source: string, settings: string): Promise<string> {
		const data = source + "|" + settings;
		// Simple hash using SubtleCrypto if available, otherwise DJB2
		if (typeof crypto !== "undefined" && crypto.subtle) {
			const buf = new TextEncoder().encode(data);
			const hash = await crypto.subtle.digest("SHA-256", buf);
			const arr = Array.from(new Uint8Array(hash));
			return arr.map(b => b.toString(16).padStart(2, "0")).join("");
		}
		// DJB2 fallback
		let hash = 5381;
		for (let i = 0; i < data.length; i++) {
			hash = ((hash << 5) + hash + data.charCodeAt(i)) | 0;
		}
		return "djb2_" + (hash >>> 0).toString(16);
	}
}
