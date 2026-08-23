import { RawTomlEditor, type RawTomlEditorProps } from "../common/RawTomlEditor.tsx";

export type CharacterRawEditorProps = RawTomlEditorProps;

export function CharacterRawEditor(props: Readonly<CharacterRawEditorProps>) {
	return <RawTomlEditor {...props} />;
}
