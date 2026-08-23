export interface SSEEvent {
	event?: string;
	data: string;
	id?: string;
	retry?: number;
}
