import {
	buildDag,
	defaultNodeRegistry,
	InMemoryRunLogger,
	WorkflowExecutor,
} from "@mdirshadengineer/agentflow-core";
import type { NodeExecutor, NodeOutput } from "@mdirshadengineer/agentflow-core";
import { randomUUID } from "node:crypto";

/**
 * Sub-Workflow executor.
 *
 * Executes an embedded workflow definition as a nested sub-step.  The
 * sub-workflow runs inside the same process using an in-memory logger so
 * its internal step logs are captured and surfaced via the parent step's
 * `logs` field.
 *
 * Config fields:
 * - `definition` {object}  — required — inline workflow definition
 *                             ({ steps: [...] } or { nodes: [], edges: [] })
 * - `inputs`     {object}  — optional — key-value pairs injected as
 *                             `previousOutputs.__inputs__` for the sub-steps
 */
export const subworkflowExecutor: NodeExecutor = async (input, context) => {
	const { definition, inputs } = input.data;

	if (
		definition === null ||
		definition === undefined ||
		typeof definition !== "object" ||
		Array.isArray(definition)
	) {
		return {
			data: {},
			status: "failed",
			logs: `subworkflow: "definition" config field must be a workflow definition object (runId: ${context.runId})`,
		};
	}

	const workflowDef = buildDag(definition as Record<string, unknown>);

	const steps = workflowDef.steps ?? [];
	if (steps.length === 0) {
		return {
			data: { stepOutputs: {}, status: "success" },
			status: "success",
			logs: `subworkflow: definition has no steps — nothing to execute (runId: ${context.runId})`,
		};
	}

	// Inject inputs into the first step's config if provided
	if (inputs && typeof inputs === "object" && !Array.isArray(inputs)) {
		const firstStep = steps[0];
		if (firstStep) {
			firstStep.config = {
				...(firstStep.config ?? {}),
				...(inputs as Record<string, unknown>),
			};
		}
	}

	const subRunId = randomUUID();
	const subWorkflowId = `sub:${context.workflowId}`;
	const logger = new InMemoryRunLogger();
	const executor = new WorkflowExecutor(defaultNodeRegistry, logger);

	let finalStatus: "success" | "failed";
	try {
		finalStatus = await executor.run(subRunId, subWorkflowId, workflowDef);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			data: {},
			status: "failed",
			logs: `subworkflow: execution threw an error — ${message} (runId: ${context.runId})`,
		};
	}

	// Collect per-step logs from the in-memory logger
	const stepLogs = await logger.getLogsForRun(subRunId);
	const logLines = stepLogs.map(
		(s) => `  [${s.status}] ${s.stepName}${s.logs ? `: ${s.logs}` : ""}`,
	);

	// Build stepOutputs map from logger state
	const stepOutputs: Record<string, NodeOutput["data"]> = {};
	for (const s of stepLogs) {
		stepOutputs[s.stepName] = { status: s.status, logs: s.logs ?? "" };
	}

	return {
		data: { stepOutputs, status: finalStatus },
		status: finalStatus,
		logs: [
			`subworkflow: ${steps.length} step(s), status=${finalStatus} (runId: ${context.runId})`,
			...logLines,
		].join("\n"),
	};
};
