import { Badge } from "@/components/common/Badge.tsx";
import { EmptyState } from "@/components/common/EmptyState.tsx";
import { getLoreBook } from "@/shared/lore/registry.ts";
import type { StoredUniversefile } from "@/shared/universe/registry.ts";
import type { StoredWorldfile } from "@/shared/world/registry.ts";
import type { WorldInstance } from "@/shared/world/types.ts";
import styles from "../InstanceManagerView.module.css";

export interface InstanceDetailProps {
	selectedInstance?: WorldInstance;
	activeId: string | null;
	selectedWorldfile?: StoredWorldfile;
	selectedUniverse?: StoredUniversefile;
	onActivateInstance: (id: string) => void;
	onDeleteInstance: (id: string) => void;
	onNavigateTab?: (tab: "chat" | "world-manager") => void;
}

export function InstanceDetail(props: Readonly<InstanceDetailProps>) {

	const {
		selectedInstance,
		activeId,
		selectedWorldfile,
		selectedUniverse,
		onActivateInstance,
		onDeleteInstance,
		onNavigateTab,
	} = props;

	const attachedLorebookIds = selectedInstance
		? (selectedInstance.lorebookIds && selectedInstance.lorebookIds.length > 0
				? selectedInstance.lorebookIds
				: selectedInstance.lorebookId
					? [selectedInstance.lorebookId]
					: [])
		: [];

	return (
		<main className={styles.contentArea}>
			{selectedInstance
				? (
						<div className={styles.card}>
							<h2 className={styles.sectionTitle}>{selectedInstance.title}</h2>

							<div className={styles.badgeGroup}>
								{selectedInstance.id === activeId && (
									<Badge variant="active">
										Currently Active Session
									</Badge>
								)}
								<Badge>
									ID:
									{selectedInstance.id}
								</Badge>
								<Badge>
									Created: 
									{" "}
									{new Date(selectedInstance.createdAt).toLocaleString()}
								</Badge>
								<Badge>
									Mode: 
									{" "}
									{selectedInstance.universeMode}
								</Badge>
							</div>

							<div className={styles.actions}>
								{selectedInstance.id !== activeId
									? (
											<button
												type="button"
												className={styles.primaryButton}
												onClick={() => onActivateInstance(selectedInstance.id)}
											>
												Set as Active & Open Chat
											</button>
										)
									: (
											<button
												type="button"
												className={styles.secondaryButton}
												onClick={() => onNavigateTab?.("chat")}
											>
												Open Active Chat
											</button>
										)}
								<button
									type="button"
									className={styles.dangerButton}
									onClick={() => onDeleteInstance(selectedInstance.id)}
								>
									Delete Instance
								</button>
							</div>

							<div className={styles.card}>
								<h3 className={styles.label}>Worldfile Reference</h3>
								<p className={styles.hint}>
									{selectedWorldfile?.worldfile.metadata.title || selectedInstance.worldId}
									{" "}
									(v
									{selectedWorldfile?.worldfile.metadata.version || "1.0.0"}
									)
								</p>
								<p>{selectedWorldfile?.worldfile.metadata.description}</p>
							</div>

							{selectedUniverse && (
								<div className={styles.card}>
									<h3 className={styles.label}>Attached Universe</h3>
									<p className={styles.hint}>
										{selectedUniverse.universe.metadata.title}
										{" "}
										(
										{selectedInstance.universeMode}
										{" "}
										mode)
									</p>
									{selectedUniverse.universe.settings?.backgrounds && selectedUniverse.universe.settings.backgrounds.length > 0 && (
										<div>
											<h4 className={styles.label}>Universal Background Story</h4>
											<ul>
												{selectedUniverse.universe.settings.backgrounds.map((bg, idx) => (
													<li key={idx}>{bg}</li>
												))}
											</ul>
										</div>
									)}
									{selectedUniverse.universe.settings?.rules && selectedUniverse.universe.settings.rules.length > 0 && (
										<div>
											<h4 className={styles.label}>Universal Invariant Rules</h4>
											<ul>
												{selectedUniverse.universe.settings.rules.map((rule, idx) => (
													<li key={idx}>{rule}</li>
												))}
											</ul>
										</div>
									)}
								</div>
							)}

							{attachedLorebookIds.length > 0 && (
								<div className={styles.card}>
									<h3 className={styles.label}>
										Attached Lore Books (
										{attachedLorebookIds.length}
										)
									</h3>
									<ul>
										{attachedLorebookIds.map((lorebookId) => {
											const record = getLoreBook(lorebookId);
											const name = record?.lorebook.name || lorebookId;
											const entryCount = record?.lorebook.entries.length ?? 0;

											return (
												<li key={lorebookId}>
													<strong>{name}</strong>
													{" "}
													<span className={styles.hint}>
														(
														{lorebookId}
														{" • "}
														{entryCount}
														{" entries"}
														)
													</span>
												</li>
											);
										})}
									</ul>
								</div>
							)}

							<div className={styles.card}>
								<h3 className={styles.label}>Injected Runtime Variables</h3>
								{Object.keys(selectedInstance.injectedVars || {}).length > 0
									? (
											<div className={styles.formGrid}>
												{Object.entries(selectedInstance.injectedVars).map(([key, val]) => (
													<div key={key} className={styles.varItem}>
														<span className={styles.label}>{key}</span>
														<span>{String(val)}</span>
													</div>
												))}
											</div>
										)
									: (
											<p className={styles.hint}>No runtime variables injected.</p>
										)}
							</div>

							<div className={styles.card}>
								<h3 className={styles.label}>
									Character Instances (
									{selectedInstance.characterInstances?.length || 0}
									)
								</h3>
								{selectedInstance.characterInstances && selectedInstance.characterInstances.length > 0
									? (
											<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
												{selectedInstance.characterInstances.map(ci => (
													<div
														key={ci.id}
														style={{
															border: "1px solid #e0e0e0",
															padding: "12px",
															borderRadius: "4px",
															backgroundColor: "#fafafa",
														}}
													>
														<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
															<strong>{ci.name}</strong>
															<Badge>{ci.characterId}</Badge>
														</div>

														{ci.thoughts && ci.thoughts.length > 0 && (
															<div style={{ marginTop: "8px" }}>
																<span style={{ fontSize: "12px", fontWeight: "bold", color: "#444" }}>Recent Thoughts:</span>
																<ul style={{ margin: "4px 0 0 16px", padding: 0, fontSize: "13px" }}>
																	{ci.thoughts.map(t => (
																		<li key={t.id}>
																			<strong>
																				{t.title}
																				:
																			</strong> 
																			{" "}
																			{t.internal_monologue}
																		</li>
																	))}
																</ul>
															</div>
														)}

														{ci.emotions && ci.emotions.length > 0 && (
															<div style={{ marginTop: "8px" }}>
																<span style={{ fontSize: "12px", fontWeight: "bold", color: "#444" }}>Recent Emotions:</span>
																<ul style={{ margin: "4px 0 0 16px", padding: 0, fontSize: "13px" }}>
																	{ci.emotions.map(e => (
																		<li key={e.id}>
																			<strong>
																				{e.name}
																				:
																			</strong> 
																			{" "}
																			{e.internal_monologue}
																		</li>
																	))}
																</ul>
															</div>
														)}

														{ci.goals && ci.goals.length > 0 && (
															<div style={{ marginTop: "8px" }}>
																<span style={{ fontSize: "12px", fontWeight: "bold", color: "#444" }}>Goals:</span>
																<ul style={{ margin: "4px 0 0 16px", padding: 0, fontSize: "13px" }}>
																	{ci.goals.map(g => (
																		<li key={g.id}>
																			<strong>
																				{g.name}
																				:
																			</strong> 
																			{" "}
																			{g.internal_monologue}
																		</li>
																	))}
																</ul>
															</div>
														)}

														{ci.states && Object.keys(ci.states).length > 0 && (
															<div style={{ marginTop: "8px" }}>
																<span style={{ fontSize: "12px", fontWeight: "bold", color: "#444" }}>States:</span>
																<div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
																	{Object.entries(ci.states).map(([k, v]) => (
																		<span
																			key={k}
																			style={{
																				fontSize: "12px",
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
												))}
											</div>
										)
									: (
											<p className={styles.hint}>No character instances in this session.</p>
										)}
							</div>
						</div>
					)
				: (
						<EmptyState message="Select an instance from the left sidebar to view details." />
					)}
		</main>
	);

}
