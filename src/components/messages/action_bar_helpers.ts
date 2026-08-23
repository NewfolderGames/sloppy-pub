export function formatTokens(tokens: number): string {

	return `${tokens} ${tokens === 1 ? "token" : "tokens"}`;

}

export function formatDuration(durationMs: number): string {

	const seconds = durationMs / 1000;
	if (seconds >= 10) {
		return `${seconds.toFixed(1)}s`;
	}

	return `${seconds.toFixed(2)}s`;

}
