import type { WorkflowDefinition, WorkflowStep } from "./types.js";

// ── Canvas representation ────────────────────────────────────────────────────

/** A node as stored in the canvas workflow definition. */
export interface CanvasNode {
	id: string;
	/** The node's execution type (e.g. "http-request", "delay", "trigger"). */
	type: string;
	position?: { x: number; y: number };
	/** Type-specific configuration data from the canvas editor. */
	data: Record<string, unknown>;
}

/** An edge as stored in the canvas workflow definition. */
export interface CanvasEdge {
	id: string;
	source: string;
	target: string;
}

/** The raw canvas-format workflow definition (nodes + edges). */
export interface CanvasWorkflowDefinition {
	nodes: CanvasNode[];
	edges: CanvasEdge[];
}

// ── buildDag ─────────────────────────────────────────────────────────────────

/**
 * Converts an arbitrary raw workflow definition into the execution-format
 * {@link WorkflowDefinition} consumed by {@link WorkflowExecutor}.
 *
 * Handles two input shapes:
 * - **Canvas format** `{ nodes, edges }` — produced by the visual workflow
 *   editor.  Each canvas node becomes a {@link WorkflowStep}; edges are
 *   translated into `dependsOn` references.
 * - **Steps format** `{ steps }` — already in execution format; returned
 *   as-is so it can be used directly without re-processing.
 *
 * Any other (unrecognised) input returns an empty `WorkflowDefinition`.
 */
export function buildDag(raw: unknown): WorkflowDefinition {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
		return {};
	}

	const def = raw as Record<string, unknown>;

	// ── Already in steps format ──────────────────────────────────────────────
	if (Array.isArray(def.steps)) {
		return raw as WorkflowDefinition;
	}

	// ── Canvas format ────────────────────────────────────────────────────────
	if (Array.isArray(def.nodes)) {
		const nodes = def.nodes as CanvasNode[];
		const edges = (
			Array.isArray(def.edges) ? def.edges : []
		) as CanvasEdge[];

		// Build a map: targetNodeId → [dependencyNodeIds]
		const dependencyMap = new Map<string, string[]>();
		for (const node of nodes) {
			dependencyMap.set(node.id, []);
		}
		for (const edge of edges) {
			const deps = dependencyMap.get(edge.target);
			if (deps) {
				deps.push(edge.source);
			}
		}

		// Every canvas node becomes a workflow step.
		// Unknown types (e.g. "trigger") fall back to a no-op in the registry.
		const steps: WorkflowStep[] = nodes.map((node) => {
			const deps = dependencyMap.get(node.id) ?? [];
			return {
				name: node.id,
				type: node.type,
				config: node.data,
				...(deps.length > 0 ? { dependsOn: deps } : {}),
			};
		});

		// Extract cron triggers from trigger-type canvas nodes
		const triggers: WorkflowDefinition["triggers"] = nodes
			.filter((n) => n.type === "trigger" && n.data.triggerType === "cron")
			.map((n) => ({
				type: "cron" as const,
				cron: n.data.cron as string,
			}));

		return {
			steps,
			...(triggers.length > 0 ? { triggers } : {}),
		};
	}

	return {};
}
