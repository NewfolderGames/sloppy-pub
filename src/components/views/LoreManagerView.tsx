import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/common/Alert.tsx";
import { deleteLoreBook, exportLorebookAsFile, getAllLoreBooks, getLoreBook, importLorebookFromToml, saveLoreBook } from "@/shared/lore/registry.ts";
import { parseLorebook, serializeLorebook } from "@/shared/lore/toml.ts";
import type { LoreBook, LoreEntry, StoredLoreBook } from "@/shared/lore/types.ts";
import { LoreBookDetail } from "./lore-manager/LoreBookDetail.tsx";
import { LoreBookList } from "./lore-manager/LoreBookList.tsx";
import { LoreBookRawEditor } from "./lore-manager/LoreBookRawEditor.tsx";
import { LoreEntryEditor } from "./lore-manager/LoreEntryEditor.tsx";
import styles from "./LoreManagerView.module.css";

// Helper Functions

function generateId(): string {
	return `id_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

function emptyLoreBook(): LoreBook {
	return {
		id: generateId(),
		name: "",
		entries: [],
	};
}

function emptyLoreEntry(): LoreEntry {
	return {
		id: generateId(),
		title: "",
		content: "",
		keywords: [],
		activationMode: "static",
		enabled: true,
	};
}

interface Props {
	className?: string;
	onEditorContextChange?: (context: {
		activeId: string | null;
		rawToml: string;
		summary?: Record<string, unknown>;
	}) => void;
	applyDiffCallbackRef?: React.MutableRefObject<((proposedToml: string) => void) | null>;
}

export function LoreManagerView(props: Readonly<Props>) {

	const { className, onEditorContextChange, applyDiffCallbackRef } = props;

	// Component State

	const [storedList, setStoredList] = useState<StoredLoreBook[]>(() => getAllLoreBooks());
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	// New lore book creation

	const [newName, setNewName] = useState("");

	// TOML raw editor

	const [rawToml, setRawToml] = useState("");
	const [showRaw, setShowRaw] = useState(false);

	// Inline editing of entries

	const [editingEntry, setEditingEntry] = useState<LoreEntry | null>(null);
	const [editingEntryKeywordsText, setEditingEntryKeywordsText] = useState("");

	// Memoized Lore Book Data

	const selectedRecord = useMemo(() => {
		if (!selectedId) {
			return undefined;
		}

		return storedList.find(record => record.id === selectedId) ?? getLoreBook(selectedId);
	}, [selectedId, storedList]);

	const selectedBook = selectedRecord?.lorebook;

	const serializedToml = useMemo(() => {
		if (!selectedBook) {
			return "";
		}

		return serializeLorebook(selectedBook);
	}, [selectedBook]);

	const entryCount = useMemo(() => {
		return selectedBook?.entries.length ?? 0;
	}, [selectedBook?.entries.length]);

	const staticCount = useMemo(() => {
		if (!selectedBook) {
			return 0;
		}

		return selectedBook.entries.filter(e => e.activationMode === "static").length;
	}, [selectedBook]);

	const dynamicCount = useMemo(() => {
		if (!selectedBook) {
			return 0;
		}

		return selectedBook.entries.filter(e => e.activationMode === "dynamic").length;
	}, [selectedBook]);

	// Callbacks

	const refreshList = useCallback(() => {
		setStoredList(getAllLoreBooks());
	}, []);

	const handleSelect = useCallback((id: string) => {
		setSelectedId(id);
		setError(null);
		setSuccess(null);
		setEditingEntry(null);
		setShowRaw(false);
	}, []);

	const handleCreateNew = useCallback(() => {
		const trimmed = newName.trim();

		if (!trimmed) {
			setError("Lore book name is required.");
			return;
		}

		const book = emptyLoreBook();

		book.name = trimmed;
		book.id = trimmed.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();

		try {
			saveLoreBook(book);
			refreshList();
			setSelectedId(book.id);
			setNewName("");
			setError(null);
			setSuccess(`Lore book "${trimmed}" created.`);
		}
		catch (e) {
			setError(`Failed to create lore book: ${e instanceof Error ? e.message : String(e)}`);
		}
	}, [newName, refreshList]);

	const handleDelete = useCallback(() => {
		if (!selectedId) {
			return;
		}

		if (!window.confirm("Delete this lore book? This cannot be undone.")) {
			return;
		}

		try {
			deleteLoreBook(selectedId);
			refreshList();
			setSelectedId(null);
			setError(null);
			setSuccess("Lore book deleted.");
		}
		catch (e) {
			setError(`Failed to delete: ${e instanceof Error ? e.message : String(e)}`);
		}
	}, [selectedId, refreshList]);

	const handleSave = useCallback(() => {
		if (!selectedBook || !selectedId) {
			return;
		}

		try {
			saveLoreBook(selectedBook, selectedId);
			refreshList();
			setError(null);
			setSuccess("Lore book saved.");
		}
		catch (e) {
			setError(`Failed to save: ${e instanceof Error ? e.message : String(e)}`);
		}
	}, [selectedBook, selectedId, refreshList]);

	const handleExport = useCallback(() => {
		if (!selectedId) {
			return;
		}

		try {
			exportLorebookAsFile(selectedId);
			setSuccess("Lore book exported.");
		}
		catch (e) {
			setError(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
		}
	}, [selectedId]);

	const handleImport = useCallback(() => {
		const text = rawToml.trim();

		if (!text) {
			setError("Paste TOML content first.");
			return;
		}

		try {
			const result = importLorebookFromToml(text);

			refreshList();
			setSelectedId(result.id);
			setRawToml("");
			setShowRaw(false);
			setError(null);
			setSuccess("Lore book imported from TOML.");
		}
		catch (e) {
			setError(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
		}
	}, [rawToml, refreshList]);

	const handleNameChange = useCallback((newNameValue: string) => {
		if (!selectedBook || !selectedId) {
			return;
		}

		const updatedBook: LoreBook = {
			...selectedBook,
			name: newNameValue,
		};

		saveLoreBook(updatedBook, selectedId);
		refreshList();
	}, [selectedBook, selectedId, refreshList]);

	const handleAddEntry = useCallback(() => {
		if (!selectedBook || !selectedId) {
			return;
		}

		const entry: LoreEntry = {
			...emptyLoreEntry(),
			title: "New Entry",
			content: "Describe the lore entry.",
		};

		const updatedBook: LoreBook = {
			...selectedBook,
			entries: [...selectedBook.entries, entry],
		};

		saveLoreBook(updatedBook, selectedId);
		setEditingEntry(entry);
		setEditingEntryKeywordsText(entry.keywords.join(", "));
		refreshList();
	}, [selectedBook, selectedId, refreshList]);

	const handleEditEntry = useCallback((entry: LoreEntry) => {
		setEditingEntry({ ...entry });
		setEditingEntryKeywordsText(entry.keywords.join(", "));
	}, []);

	const handleSaveEntry = useCallback((e: FormEvent) => {
		e.preventDefault();

		if (!editingEntry || !selectedBook || !selectedId) {
			return;
		}

		const keywords = editingEntryKeywordsText
			.split(",")
			.map(k => k.trim())
			.filter(k => k.length > 0);

		const updatedEntry: LoreEntry = {
			...editingEntry,
			keywords,
		};

		const updatedEntries = selectedBook.entries.map(item =>
			item.id === updatedEntry.id ? updatedEntry : item,
		);

		const updatedBook: LoreBook = {
			...selectedBook,
			entries: updatedEntries,
		};

		saveLoreBook(updatedBook, selectedId);
		setEditingEntry(null);
		refreshList();
	}, [editingEntry, selectedBook, selectedId, editingEntryKeywordsText, refreshList]);

	const handleRemoveEntry = useCallback((id: string) => {
		if (!selectedBook || !selectedId) {
			return;
		}

		const updatedBook: LoreBook = {
			...selectedBook,
			entries: selectedBook.entries.filter(en => en.id !== id),
		};

		saveLoreBook(updatedBook, selectedId);
		setEditingEntry(null);
		refreshList();
	}, [selectedBook, selectedId, refreshList]);

	const toggleRaw = useCallback(() => {
		if (!showRaw && selectedBook) {
			setRawToml(serializeLorebook(selectedBook));
			setShowRaw(true);
			return;
		}

		setShowRaw(false);
	}, [showRaw, selectedBook]);

	const applyRawToml = useCallback((proposedToml?: string) => {
		if (!selectedId) {
			return;
		}

		const source = typeof proposedToml === "string" ? proposedToml : rawToml;

		try {
			const parsed = parseLorebook(source);

			parsed.id = selectedId;
			saveLoreBook(parsed, selectedId);
			refreshList();
			setRawToml(serializeLorebook(parsed));
			setShowRaw(false);
			setError(null);
			setSuccess("Raw TOML applied.");
		}
		catch (e) {
			setError(`Failed to parse TOML: ${e instanceof Error ? e.message : String(e)}`);
		}
	}, [selectedId, rawToml, refreshList]);

	const handleCancelEditingEntry = useCallback(() => {
		setEditingEntry(null);
	}, []);

	// Effects

	useEffect(() => {
		onEditorContextChange?.({
			activeId: selectedId,
			rawToml: showRaw ? rawToml : serializedToml,
			summary: selectedBook
				? {
						name: selectedBook.name,
						entryCount: selectedBook.entries.length,
						staticCount: selectedBook.entries.filter(e => e.activationMode === "static").length,
						dynamicCount: selectedBook.entries.filter(e => e.activationMode === "dynamic").length,
					}
				: undefined,
		});
	}, [onEditorContextChange, selectedId, selectedBook, showRaw, rawToml, serializedToml]);

	useEffect(() => {
		if (applyDiffCallbackRef) {
			applyDiffCallbackRef.current = (proposedToml: string) => {
				applyRawToml(proposedToml);
			};
		}
	});

	const handlePromptRename = useCallback(() => {
		if (!selectedBook) {
			return;
		}

		const promptResult = window.prompt("Rename lore book:", selectedBook.name);
		if (promptResult) {
			handleNameChange(promptResult);
		}
	}, [selectedBook, handleNameChange]);

	// Render

	const containerClassName = `${styles.container} ${className ?? ""}`.trim();

	return (
		<div className={containerClassName}>
			<div className={styles.topBar}>
				<h2 className={styles.title}>Lore Book Manager</h2>

				<div className={styles.headerActions}>
					<input
						className={styles.input}
						style={{ width: "200px" }}
						placeholder="New lore book name..."
						value={newName}
						onChange={e => setNewName(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								handleCreateNew();
							}
						}}
					/>

					<button
						type="button"
						className={`${styles.button} ${styles.primaryButton}`}
						onClick={handleCreateNew}
					>
						Create
					</button>
				</div>
			</div>

			{error && <Alert variant="error">{error}</Alert>}
			{success && <Alert variant="success">{success}</Alert>}

			<div className={styles.mainLayout}>
				<LoreBookList
					storedList={storedList}
					selectedId={selectedId}
					onSelect={handleSelect}
				/>

				<div className={styles.contentPanel}>
					{!selectedBook && (
						<p className={styles.emptyState}>
							Select or create a lore book to manage its entries.
						</p>
					)}

					{selectedBook && !showRaw && !editingEntry && (
						<LoreBookDetail
							selectedBook={selectedBook}
							entryCount={entryCount}
							staticCount={staticCount}
							dynamicCount={dynamicCount}
							onRename={handlePromptRename}
							onSave={handleSave}
							onToggleRaw={toggleRaw}
							onExport={handleExport}
							onDelete={handleDelete}
							onAddEntry={handleAddEntry}
							onEditEntry={handleEditEntry}
							onRemoveEntry={handleRemoveEntry}
						/>
					)}

					{selectedBook && !showRaw && editingEntry && (
						<LoreEntryEditor
							entry={editingEntry}
							keywordsText={editingEntryKeywordsText}
							onChangeEntry={setEditingEntry as (updater: (prev: LoreEntry) => LoreEntry) => void}
							onChangeKeywordsText={setEditingEntryKeywordsText}
							onSave={handleSaveEntry}
							onCancel={handleCancelEditingEntry}
						/>
					)}

					{selectedBook && showRaw && (
						<LoreBookRawEditor
							rawToml={rawToml}
							onChangeRawToml={setRawToml}
							onApply={applyRawToml}
							onBack={toggleRaw}
							onImport={handleImport}
						/>
					)}
				</div>
			</div>
		</div>
	);

}
