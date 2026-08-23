import { useMemo } from "react";
import type { AssistantDiffPayload } from "../../../shared/ai/assistance/types.ts";
import { computeStructuredDiff } from "../../../shared/ai/assistance/diff.ts";
import styles from "./AssistantDiffCard.module.css";

export interface AssistantDiffCardProps {
	payload: AssistantDiffPayload;
	onApply: (payload: AssistantDiffPayload) => void;
	onReject: (payload: AssistantDiffPayload) => void;
	disabled?: boolean;
}

export function AssistantDiffCard(props: AssistantDiffCardProps) {

	const { payload, onApply, onReject, disabled = false } = props;

	const structuredDiff = useMemo(() => {
		return computeStructuredDiff(payload.originalText, payload.proposedText);
	}, [payload.originalText, payload.proposedText]);

	const statusClass = payload.status === "applied"
		? styles.statusApplied
		: payload.status === "rejected"
			? styles.statusRejected
			: styles.statusPending;

	return (
		<div className={styles.card} data-testid="assistant-diff-card">
			<div className={styles.header}>
				<div className={styles.titleArea}>
					<span className={styles.tabBadge}>{payload.tab}</span>
					<span className={`${styles.statusBadge} ${statusClass}`}>{payload.status}</span>
					<h4 className={styles.title}>{payload.title}</h4>
				</div>

				<div className={styles.stats}>
					<span className={styles.additions}>
						+
						{structuredDiff.additionsCount}
					</span>
					<span className={styles.deletions}>
						-
						{structuredDiff.deletionsCount}
					</span>
				</div>
			</div>

			<div className={styles.diffContainer}>
				{structuredDiff.hunks.length === 0
					? (
							<div className={styles.hunkHeader}>No textual changes</div>
						)
					: (
							structuredDiff.hunks.map((hunk, hunkIdx) => (
								<div key={hunkIdx} className={styles.diffHunk}>
									<div className={styles.hunkHeader}>
										@@ -
										{hunk.oldStart}
										,
										{hunk.oldLines}
										{" "}
										+
										{hunk.newStart}
										,
										{hunk.newLines}
										{" "}
										@@
									</div>

									{hunk.lines.map((line, lineIdx) => {
										const lineClass = line.type === "add"
											? styles.lineAdd
											: line.type === "delete"
												? styles.lineDelete
												: styles.lineNormal;

										const indicator = line.type === "add" ? "+" : line.type === "delete" ? "-" : " ";
										const displayedLineNumber = line.type === "add"
											? line.newLineNumber
											: line.type === "delete"
												? line.oldLineNumber
												: line.newLineNumber ?? line.oldLineNumber;

										return (
											<div key={lineIdx} className={`${styles.diffLine} ${lineClass}`}>
												<span className={styles.lineNumber}>{displayedLineNumber ?? ""}</span>
												<span className={styles.lineIndicator}>{indicator}</span>
												<span className={styles.lineContent}>{line.content}</span>
											</div>
										);
									})}
								</div>
							))
						)}
			</div>

			<div className={styles.actions}>
				{payload.status === "pending" && (
					<>
						<button
							type="button"
							className={styles.rejectButton}
							disabled={disabled}
							onClick={() => onReject(payload)}
						>
							Reject
						</button>
						<button
							type="button"
							className={styles.applyButton}
							disabled={disabled}
							onClick={() => onApply(payload)}
						>
							Apply Changes
						</button>
					</>
				)}

				{payload.status === "applied" && (
					<span className={styles.appliedBanner}>Applied to editor</span>
				)}

				{payload.status === "rejected" && (
					<span className={styles.rejectedBanner}>Change rejected</span>
				)}
			</div>
		</div>
	);

}

export default AssistantDiffCard;
