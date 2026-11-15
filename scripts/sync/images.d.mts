export function normalizeWebp(bytes: Uint8Array): Promise<Buffer>;
export function writeImageAtomic(filename: string, bytes: Uint8Array): void;
export function normalizeStaticImages(root?: string): Promise<{ converted: number; thumbnails: number }>;
