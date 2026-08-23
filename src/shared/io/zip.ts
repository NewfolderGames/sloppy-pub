import JSZip from "jszip";

export interface ZipEntry {
	path: string;
	data: Uint8Array;
}

export async function createZip(entries: ZipEntry[]): Promise<Uint8Array> {
	const zip = new JSZip();

	for (const entry of entries) {
		zip.file(entry.path, entry.data);
	}

	const content = await zip.generateAsync({
		type: "uint8array",
		compression: "DEFLATE",
		compressionOptions: { level: 6 },
	});

	return content;
}

export async function readZip(buf: Uint8Array): Promise<ZipEntry[]> {
	const zip = await JSZip.loadAsync(buf);
	const entries: ZipEntry[] = [];
	const filePromises: Promise<void>[] = [];

	zip.forEach((relativePath, zipObject) => {
		if (!zipObject.dir) {
			filePromises.push(
				zipObject.async("uint8array").then((data) => {
					entries.push({
						path: relativePath,
						data,
					});
				}),
			);
		}
	});

	await Promise.all(filePromises);

	return entries;
}
