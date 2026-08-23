export interface LorebookSelection {
	lorebookId?: string;
	lorebookIds?: string[];
}

export function resolveSessionLorebookIds(
	instance: LorebookSelection,
	session: LorebookSelection,
): string[] {

	return instance.lorebookIds
		?? session.lorebookIds
		?? (instance.lorebookId
			? [instance.lorebookId]
			: session.lorebookId
				? [session.lorebookId]
				: []);

}
