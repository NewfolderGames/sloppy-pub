import React from "react";
import styles from "./MetadataFormSection.module.css";

export interface MetadataFormSectionProps {
	name: string;
	onNameChange: (value: string) => void;
	version: string;
	onVersionChange: (value: string) => void;
	title: string;
	onTitleChange: (value: string) => void;
	description: string;
	onDescriptionChange: (value: string) => void;
	authors: string;
	onAuthorsChange: (value: string) => void;
	tags: string;
	onTagsChange: (value: string) => void;
	sectionTitle?: string;
	namePlaceholder?: string;
	titlePlaceholder?: string;
	descriptionPlaceholder?: string;
	authorsPlaceholder?: string;
	tagsPlaceholder?: string;
}

export const MetadataFormSection: React.FC<MetadataFormSectionProps> = ({
	name,
	onNameChange,
	version,
	onVersionChange,
	title,
	onTitleChange,
	description,
	onDescriptionChange,
	authors,
	onAuthorsChange,
	tags,
	onTagsChange,
	sectionTitle = "Metadata",
	namePlaceholder = "unique_name",
	titlePlaceholder = "Display Title",
	descriptionPlaceholder = "Description overview...",
	authorsPlaceholder = "Author One, Author Two",
	tagsPlaceholder = "tag1, tag2",
}) => {
	return (
		<div className={styles.section}>
			<h4 className={styles.sectionTitle}>{sectionTitle}</h4>

			<div className={styles.formGrid}>
				<div className={styles.formGroup}>
					<label className={styles.label}>Identifier (name)</label>
					<input
						className={styles.input}
						value={name}
						onChange={e => onNameChange(e.target.value)}
						placeholder={namePlaceholder}
						required
					/>
				</div>

				<div className={styles.formGroup}>
					<label className={styles.label}>Version</label>
					<input
						className={styles.input}
						value={version}
						onChange={e => onVersionChange(e.target.value)}
						placeholder="1.0.0"
					/>
				</div>

				<div className={styles.formGroup}>
					<label className={styles.label}>Display Title</label>
					<input
						className={styles.input}
						value={title}
						onChange={e => onTitleChange(e.target.value)}
						placeholder={titlePlaceholder}
						required
					/>
				</div>
			</div>

			<div className={styles.formGroup}>
				<label className={styles.label}>Description</label>
				<textarea
					className={styles.textarea}
					value={description}
					onChange={e => onDescriptionChange(e.target.value)}
					placeholder={descriptionPlaceholder}
					rows={2}
				/>
			</div>

			<div className={styles.formGrid}>
				<div className={styles.formGroup}>
					<label className={styles.label}>Authors (comma separated)</label>
					<input
						className={styles.input}
						value={authors}
						onChange={e => onAuthorsChange(e.target.value)}
						placeholder={authorsPlaceholder}
					/>
				</div>

				<div className={styles.formGroup}>
					<label className={styles.label}>Tags (comma separated)</label>
					<input
						className={styles.input}
						value={tags}
						onChange={e => onTagsChange(e.target.value)}
						placeholder={tagsPlaceholder}
					/>
				</div>
			</div>
		</div>
	);
};
