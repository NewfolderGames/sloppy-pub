import { type SubmitEvent } from "react";
import styles from "./AppInput.module.css";

interface Props {
	onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
	onOpenWorldInfo?: () => void;
}

function AppInput(props: Readonly<Props>) {
	return (
		<form
			className={styles.container}
			onSubmit={props.onSubmit}
		>
			<div className={styles.inputContainer}>
				<textarea
					name="content"
					rows={4}
					placeholder="Type a message..."
					aria-label="Message content"
				/>
			</div>
			<div className={styles.actionContainer}>
				<div className={styles.controls}>
					<button
						type="button"
						onClick={props.onOpenWorldInfo}
						title="Open World Info"
						aria-label="Open World Info"
					>
						World Info
					</button>
				</div>
				<div className={styles.controls}>
					<button
						type="submit"
						name="sendType"
						value="continue"
						title="Continue next turn"
						aria-label="Continue next turn"
					>
						Continue
					</button>
					<button
						type="submit"
						name="sendType"
						value="attach"
						title="Attach message"
						aria-label="Attach message"
					>
						Attach
					</button>
					<button
						type="submit"
						name="sendType"
						value="request"
						title="Send message"
						aria-label="Send message"
					>
						Send
					</button>
				</div>
			</div>
		</form>
	);
}

export default AppInput;
