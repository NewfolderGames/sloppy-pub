import { Badge } from "@/components/common/Badge.tsx";
import type { Characterfile, CharacterInstance } from "@/shared/character/types.ts";
import { CollapsibleSection } from "./CollapsibleSection.tsx";
import styles from "../WorldInfoDrawer.module.css";

interface CharactersSectionProps {
	characters: Characterfile[];
	characterInstances: CharacterInstance[];
}

export function CharactersSection({
	characters,
	characterInstances,
}: Readonly<CharactersSectionProps>) {

	if (characters.length === 0 && characterInstances.length === 0) {
		return null;
	}

	const displayItems = characters.length > 0 ? characters : characterInstances;
	const count = characters.length || characterInstances.length;

	return (
		<CollapsibleSection
			title={`Characters (${count})`}
			badge={<Badge>{count}</Badge>}
			defaultOpen={false}
		>
			<div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
				{displayItems.map((item, idx) => {
					const charfile = characters[idx];
					const instanceData = characterInstances.find(
						ci =>
							ci.characterId === (charfile ? charfile.metadata.name : (item as any).characterId)
							|| ci.id === (item as any).id,
					);
					const title = charfile
						? (charfile.metadata.title || charfile.metadata.name)
						: (item as any).name;

					return (
						<div
							key={idx}
							style={{
								border: "1px solid #e0e0e0",
								padding: "12px",
								borderRadius: "4px",
								backgroundColor: "#fafafa",
							}}
						>
							<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
								<h4 style={{ margin: 0, fontSize: "14px", fontWeight: "bold" }}>{title}</h4>

								{charfile && (
									<Badge>
										v
										{charfile.metadata.version}
									</Badge>
								)}
							</div>

							{charfile?.summary && (
								<p className={styles.metaText} style={{ marginTop: "6px" }}>{charfile.summary}</p>
							)}

							{charfile && charfile.physical_characteristics.length > 0 && (
								<div style={{ marginTop: "8px" }}>
									<strong className={styles.hint}>Physical Characteristics:</strong>

									<ul className={styles.list}>
										{charfile.physical_characteristics.map(t => (
											<li key={t.name}>
												<strong>
													{t.name}
													:
												</strong>
												{" "}
												{t.description || "—"}
											</li>
										))}
									</ul>
								</div>
							)}

							{charfile && charfile.linguistic_patterns.length > 0 && (
								<div style={{ marginTop: "8px" }}>
									<strong className={styles.hint}>Linguistic Patterns:</strong>

									<ul className={styles.list}>
										{charfile.linguistic_patterns.map(t => (
											<li key={t.name}>
												<strong>
													{t.name}
													:
												</strong>
												{" "}
												{t.description || "—"}
											</li>
										))}
									</ul>
								</div>
							)}

							{instanceData && (
								<div style={{ marginTop: "10px", borderTop: "1px dashed #ccc", paddingTop: "8px" }}>
									<strong className={styles.hint}>Live Instance State:</strong>

									{instanceData.thoughts.length > 0 && (
										<div style={{ marginTop: "6px" }}>
											<span style={{ fontSize: "12px", fontWeight: "bold" }}>Thoughts:</span>

											<ul className={styles.list}>
												{instanceData.thoughts.map(t => (
													<li key={t.id}>
														<em>
															{t.title}
															:
														</em>
														{" "}
														"
														{t.internal_monologue}
														"
													</li>
												))}
											</ul>
										</div>
									)}

									{instanceData.emotions.length > 0 && (
										<div style={{ marginTop: "6px" }}>
											<span style={{ fontSize: "12px", fontWeight: "bold" }}>Emotions:</span>

											<ul className={styles.list}>
												{instanceData.emotions.map(e => (
													<li key={e.id}>
														<em>
															{e.name}
															:
														</em>
														{" "}
														"
														{e.internal_monologue}
														"
													</li>
												))}
											</ul>
										</div>
									)}

									{instanceData.goals.length > 0 && (
										<div style={{ marginTop: "6px" }}>
											<span style={{ fontSize: "12px", fontWeight: "bold" }}>Goals:</span>

											<ul className={styles.list}>
												{instanceData.goals.map(g => (
													<li key={g.id}>
														<em>
															{g.name}
															:
														</em>
														{" "}
														"
														{g.internal_monologue}
														"
													</li>
												))}
											</ul>
										</div>
									)}

									{Object.keys(instanceData.states || {}).length > 0 && (
										<div style={{ marginTop: "6px" }}>
											<span style={{ fontSize: "12px", fontWeight: "bold" }}>States:</span>

											<div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
												{Object.entries(instanceData.states).map(([k, v]) => (
													<span
														key={k}
														style={{
															fontSize: "11px",
															backgroundColor: "#e8e8e8",
															padding: "2px 6px",
															borderRadius: "3px",
														}}
													>
														<code>{k}</code>
														:
														{Array.isArray(v) ? v.join(", ") : String(v)}
													</span>
												))}
											</div>
										</div>
									)}
								</div>
							)}
						</div>
					);
				})}
			</div>
		</CollapsibleSection>
	);

}
