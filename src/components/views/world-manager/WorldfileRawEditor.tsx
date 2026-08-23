import { RawTomlEditor, type RawTomlEditorProps } from "../common/RawTomlEditor.tsx";

export type WorldfileRawEditorProps = RawTomlEditorProps;

export function WorldfileRawEditor(props: Readonly<WorldfileRawEditorProps>) {
	return <RawTomlEditor {...props} />;
}
