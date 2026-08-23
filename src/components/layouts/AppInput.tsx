import { chatRoles } from "@/shared/ai/llm/common.ts";
import { type SubmitEvent, useState } from "react";
import styles from "./AppInput.module.css";

interface Props {
	onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
}

function AppInput(props: Readonly<Props>) {

	const [role, setRole] = useState(chatRoles[0]);

	return (
		<form
			className={styles.container}
			onSubmit={props.onSubmit}
			data-role={role}
		>
			<div className={styles.inputContainer}>
				<textarea name="content" rows={4} />
			</div>
			<div className={styles.actionContainer}>
				<div>

				</div>
				<div>

				</div>
				<div>
					<select name="role" value={role} onChange={e => setRole(e.target.value as any)}>
						<option value={chatRoles[0]}>{chatRoles[0]}</option>
						<option value={chatRoles[1]}>{chatRoles[1]}</option>
						{/*<option value={chatRoles[2]}>{chatRoles[2]}</option>*/}
					</select>
					<button type="submit" name="sendType" value="continue">C</button>
					<button type="submit" name="sendType" value="attach">A</button>
					<button type="submit" name="sendType" value="request">S</button>
				</div>
			</div>
		</form>
	);

}

export default AppInput;
