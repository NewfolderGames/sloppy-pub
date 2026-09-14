import { type ChangeEvent, useMemo } from "react";
import { Badge } from "@/components/common/Badge.tsx";
import type { SemanticBlueprints, StateValue, WorldStates } from "@/shared/world/types.ts";
import { getTierForValue } from "@/shared/world/semantic/validation_engine.ts";
import { CollapsibleSection } from "./CollapsibleSection.tsx";
import styles from "../WorldInfoDrawer.module.css";

interface LiveStatesSectionProps {
	stateCount: number;
	searchQuery: string;
	onSearchChange: (e: ChangeEvent<HTMLInputElement>) => void;
	filteredStateEntries: [string, StateValue][];
	blueprints?: SemanticBlueprints;
	displayStates?: WorldStates;
}

export function LiveStatesSection({
	stateCount,
	searchQuery,
	onSearchChange,
	filteredStateEntries,
	blueprints,
	displayStates = {},
}: Readonly<LiveStatesSectionProps>) {

	const query = searchQuery.toLowerCase().trim();

	// Gauges filtering & mapping
	const matchingGauges = useMemo(() => {
		if (!blueprints?.gauges) {
			return [];
		}

		return blueprints.gauges.filter((gauge) => {
			if (!query) {
				return true;
			}

			const rawVal = displayStates[gauge.key];
			const val = typeof rawVal === "number" ? rawVal : gauge.defaultValue;
			const tier = getTierForValue(val, gauge);

			return (
				gauge.key.toLowerCase().includes(query)
				|| (tier && tier.label.toLowerCase().includes(query))
				|| (tier && tier.id.toLowerCase().includes(query))
				|| (tier && tier.directive.toLowerCase().includes(query))
			);
		});
	}, [blueprints?.gauges, displayStates, query]);

	// FSM filtering & mapping
	const matchingStateMachines = useMemo(() => {
		if (!blueprints?.stateMachines) {
			return [];
		}

		return blueprints.stateMachines.filter((fsm) => {
			if (!query) {
				return true;
			}

			const rawState = displayStates[fsm.key];
			const currentState = typeof rawState === "string" ? rawState : fsm.initialState;
			const directive = fsm.states[currentState]?.directive ?? "";

			return (
				fsm.key.toLowerCase().includes(query)
				|| currentState.toLowerCase().includes(query)
				|| directive.toLowerCase().includes(query)
			);
		});
	}, [blueprints?.stateMachines, displayStates, query]);

	// Filtered baseline entries (excluding keys managed by blueprints to avoid duplication)
	const blueprintKeys = useMemo(() => {
		const keys = new Set<string>();

		if (blueprints?.gauges) {
			for (const g of blueprints.gauges) {
				keys.add(g.key);
			}
		}

		if (blueprints?.stateMachines) {
			for (const f of blueprints.stateMachines) {
				keys.add(f.key);
			}
		}

		return keys;
	}, [blueprints]);

	const baselineEntries = useMemo(() => {
		return filteredStateEntries.filter(([k]) => !blueprintKeys.has(k));
	}, [filteredStateEntries, blueprintKeys]);

	const totalItemsCount = matchingGauges.length + matchingStateMachines.length + baselineEntries.length;

	return (
		<CollapsibleSection
			title={`Live State Variables (${stateCount})`}
			badge={<Badge>{stateCount}</Badge>}
			defaultOpen={true}
		>
			<input
				type="text"
				className={styles.searchInput}
				placeholder="Search states, gauges, tiers, or state machines..."
				value={searchQuery}
				onChange={onSearchChange}
			/>

			{/* Semantic Gauges */}
			{matchingGauges.length > 0 && (
				<div className={styles.cardList}>
					{matchingGauges.map((gauge) => {
						const rawVal = displayStates[gauge.key];
						const val = typeof rawVal === "number" ? rawVal : gauge.defaultValue;
						const tier = getTierForValue(val, gauge);
						const percent = gauge.max > gauge.min
							? Math.max(0, Math.min(100, Math.round(((val - gauge.min) / (gauge.max - gauge.min)) * 100)))
							: 0;

						return (
							<div key={gauge.key} className={styles.gaugeCard}>
								<div className={styles.gaugeHeader}>
									<span className={styles.gaugeKey}>{gauge.key}</span>
									<span className={styles.gaugeValues}>
										{val} / {gauge.max} (min: {gauge.min})
									</span>
								</div>

								<div className={styles.meterTrack}>
									<div
										className={styles.meterFill}
										style={{ width: `${percent}%` }}
									/>
								</div>

								{tier && (
									<div className={styles.tierInfo}>
										<div className={styles.tierHeader}>
											<Badge>{tier.label}</Badge>
										</div>
										{tier.directive && (
											<p className={styles.tierDirective}>{tier.directive}</p>
										)}
									</div>
								)}
							</div>
						);
					})}
				</div>
			)}

			{/* Semantic State Machines */}
			{matchingStateMachines.length > 0 && (
				<div className={styles.cardList}>
					{matchingStateMachines.map((fsm) => {
						const rawState = displayStates[fsm.key];
						const currentState = typeof rawState === "string" ? rawState : fsm.initialState;
						const directive = fsm.states[currentState]?.directive;
						const nextTransitions = fsm.transitions.filter((t) => t.from === currentState);

						return (
							<div key={fsm.key} className={styles.fsmCard}>
								<div className={styles.fsmHeader}>
									<span className={styles.fsmKey}>{fsm.key}</span>
									<Badge className={styles.fsmStateBadge}>{currentState}</Badge>
								</div>

								{directive && (
									<p className={styles.fsmDirective}>{directive}</p>
								)}

								{nextTransitions.length > 0 && (
									<div className={styles.transitionsList}>
										<span>Permitted: {nextTransitions.map((t) => t.to).join(", ")}</span>
									</div>
								)}
							</div>
						);
					})}
				</div>
			)}

			{/* Baseline Key-Value States */}
			{baselineEntries.length > 0 && (
				<table className={styles.stateTable}>
					<thead>
						<tr>
							<th>Key</th>
							<th>Value</th>
						</tr>
					</thead>

					<tbody>
						{baselineEntries.map(([key, val]) => (
							<tr key={key}>
								<td>
									<code>{key}</code>
								</td>

								<td>
									{Array.isArray(val)
										? `[${val.join(", ")}]`
										: typeof val === "boolean"
											? (val ? "true" : "false")
											: String(val)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}

			{totalItemsCount === 0 && (
				<p className={styles.hint}>No matching state variables or blueprints found.</p>
			)}
		</CollapsibleSection>
	);

}
