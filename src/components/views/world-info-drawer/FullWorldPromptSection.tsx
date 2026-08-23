import { type MouseEvent, useCallback, useState } from "react";
import { CollapsibleSection } from "./CollapsibleSection.tsx";
import styles from "../WorldInfoDrawer.module.css";

interface FullWorldPromptSectionProps {
	worldPrompt?: string;
}

export function FullWorldPromptSection({
	worldPrompt,
}: Readonly<FullWorldPromptSectionProps>) {

	const [copied, setCopied] = useState(false);

	const handleCopy = useCallback((e: MouseEvent<HTMLButtonElement>) => {
		e.stopPropagation();

		if (!worldPrompt) {
			return;
		}

		navigator.clipboard.writeText(worldPrompt).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		});
	}, [worldPrompt]);

	if (!worldPrompt || worldPrompt.trim().length === 0) {
		return (
			<CollapsibleSection
				title="Full World Prompt"
				defaultOpen={false}
			>
				<p className={styles.hint}>No world prompt available.</p>
			</CollapsibleSection>
		);
	}

	const copyBadge = (
		<button
			type="button"
			className={styles.copyButton}
			onClick={handleCopy}
			title="Copy full world prompt"
			aria-label="Copy full world prompt"
		>
			{copied ? "Copied!" : "Copy"}
		</button>
	);

	return (
		<CollapsibleSection
			title="Full World Prompt"
			badge={copyBadge}
			defaultOpen={false}
		>
			<pre className={styles.promptPre}>
				<code>{worldPrompt}</code>
			</pre>
		</CollapsibleSection>
	);

}
