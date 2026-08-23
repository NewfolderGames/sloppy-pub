import { type ChangeEvent, type SubmitEvent, useCallback, useState } from "react";
import type { ChoiceBlock } from "@/shared/ai/message/types.ts";
import styles from "./ChatMessageChoice.module.css";

interface ChatMessageChoiceProps {
	data: ChoiceBlock;
	onSelect?: (selection: string) => void;
	disabled?: boolean;
}

function ChatMessageChoice(props: Readonly<ChatMessageChoiceProps>) {

	const { data, onSelect, disabled: externalDisabled } = props;

	const [selectedOptionIds, setSelectedOptionIds] = useState<Set<string>>(new Set());
	const [customInputText, setCustomInputText] = useState("");
	const [isSubmitted, setIsSubmitted] = useState(false);

	const isDisabled = externalDisabled || isSubmitted;

	const handleOptionClick = useCallback((optionText: string) => {

		if (isDisabled) {
			return;
		}

		setIsSubmitted(true);
		onSelect?.(optionText);

	}, [isDisabled, onSelect]);

	const handleCheckboxChange = useCallback((optionId: string) => {

		if (isDisabled) {
			return;
		}

		setSelectedOptionIds((previous) => {
			const updated = new Set(previous);
			if (updated.has(optionId)) {
				updated.delete(optionId);
			}
			else {
				updated.add(optionId);
			}
			return updated;
		});

	}, [isDisabled]);

	const handleCustomInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
		setCustomInputText(e.target.value);
	}, []);

	const handleSingleCustomSubmit = useCallback((e: SubmitEvent<HTMLFormElement>) => {

		e.preventDefault();

		if (isDisabled) {
			return;
		}

		const trimmed = customInputText.trim();
		if (trimmed.length === 0) {
			return;
		}

		setIsSubmitted(true);
		onSelect?.(trimmed);

	}, [customInputText, isDisabled, onSelect]);

	const handleMultiSubmit = useCallback((e: SubmitEvent<HTMLFormElement>) => {

		e.preventDefault();

		if (isDisabled) {
			return;
		}

		const selectedTexts = data.options
			.filter(option => selectedOptionIds.has(option.id))
			.map(option => option.text);

		const trimmedCustom = customInputText.trim();
		if (trimmedCustom.length > 0) {
			selectedTexts.push(trimmedCustom);
		}

		if (selectedTexts.length === 0) {
			return;
		}

		setIsSubmitted(true);
		onSelect?.(selectedTexts.join("\n"));

	}, [customInputText, data.options, isDisabled, onSelect, selectedOptionIds]);

	if (data.multiple) {

		const hasAnySelection = selectedOptionIds.size > 0 || customInputText.trim().length > 0;

		return (
			<div className={styles.container}>
				<form onSubmit={handleMultiSubmit}>
					<div className={styles.optionsList}>
						{data.options.map(option => (
							<label
								key={option.id}
								className={styles.checkboxItem}
								data-disabled={isDisabled}
							>
								<input
									type="checkbox"
									className={styles.checkbox}
									checked={selectedOptionIds.has(option.id)}
									disabled={isDisabled}
									onChange={() => handleCheckboxChange(option.id)}
								/>
								<span className={styles.checkboxLabel}>{option.text}</span>
							</label>
						))}
					</div>

					{data.allowCustomInput && (
						<div className={styles.customInputContainer}>
							<input
								type="text"
								className={styles.customInput}
								placeholder="Other option..."
								value={customInputText}
								disabled={isDisabled}
								onChange={handleCustomInputChange}
							/>
						</div>
					)}

					<div className={styles.customInputContainer}>
						<button
							type="submit"
							className={styles.submitButton}
							disabled={isDisabled || !hasAnySelection}
						>
							Submit
						</button>
					</div>
				</form>
			</div>
		);

	}

	return (
		<div className={styles.container}>
			<div className={styles.optionsList}>
				{data.options.map(option => (
					<button
						key={option.id}
						type="button"
						className={styles.optionButton}
						disabled={isDisabled}
						onClick={() => handleOptionClick(option.text)}
					>
						{option.text}
					</button>
				))}
			</div>

			{data.allowCustomInput && (
				<form className={styles.customInputContainer} onSubmit={handleSingleCustomSubmit}>
					<input
						type="text"
						className={styles.customInput}
						placeholder="Other option..."
						value={customInputText}
						disabled={isDisabled}
						onChange={handleCustomInputChange}
					/>
					<button
						type="submit"
						className={styles.submitButton}
						disabled={isDisabled || customInputText.trim().length === 0}
					>
						Send
					</button>
				</form>
			)}
		</div>
	);

}

export default ChatMessageChoice;
