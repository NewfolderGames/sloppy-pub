import { RawTomlEditor, type RawTomlEditorProps } from "../common/RawTomlEditor.tsx";

export type UniverseRawEditorProps = RawTomlEditorProps;

export function UniverseRawEditor(props: Readonly<UniverseRawEditorProps>) {
	return <RawTomlEditor {...props} />;
}
