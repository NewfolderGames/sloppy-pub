import React from "react";
import { FeelingLuckyControl } from "@/components/common/FeelingLuckyControl.tsx";
import type { FeelingLuckyTemplateType } from "@/shared/ai/feeling_lucky.ts";
import styles from "./StringListEditor.module.css";

export interface StringListEditorProps {
	title: string;
	items: string[];
	onAdd: () => void;
	onUpdate: (index: number, value: string) => void;
	onRemove: (index: number) => void;
	addButtonLabel?: string;
	placeholder?: string;
	multiline?: boolean;
	rows?: number;
	feelingLucky?: boolean | {
		templateType?: FeelingLuckyTemplateType;
		fieldName?: string;
		context?: Record<string, unknown>;
	};
	luckyItems?: boolean[];
	onToggleLucky?: (index: number, checked: boolean) => void;
}

export const StringListEditor: React.FC<StringListEditorProps> = ({
	title,
	items,
	onAdd,
	onUpdate,
	onRemove,
	addButtonLabel = "+ Add Item",
	placeholder = "Enter value...",
	multiline = true,
	rows = 2,
	feelingLucky,
	luckyItems,
	onToggleLucky,
}) => {
	const showLucky = Boolean(feelingLucky || onToggleLucky);

	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<h4 className={styles.title}>{title}</h4>

				<button type="button" className={styles.addButton} onClick={onAdd}>
					{addButtonLabel}
				</button>
			</div>

			<div className={styles.listEditor}>
				{items.map((item, index) => (
					<div key={index} className={styles.listRow}>
						<div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
							{multiline
								? (
										<textarea
											className={styles.textarea}
											value={item}
											onChange={e => onUpdate(index, e.target.value)}
											placeholder={placeholder}
											rows={rows}
										/>
									)
								: (
										<input
											className={styles.input}
											value={item}
											onChange={e => onUpdate(index, e.target.value)}
											placeholder={placeholder}
										/>
									)}

							{showLucky && (
								<FeelingLuckyControl
									checked={luckyItems?.[index] ?? false}
									onChange={checked => onToggleLucky?.(index, checked)}
								/>
							)}
						</div>

						<button
							type="button"
							className={styles.dangerButton}
							onClick={() => onRemove(index)}
						>
							Remove
						</button>
					</div>
				))}
			</div>
		</div>
	);
};
