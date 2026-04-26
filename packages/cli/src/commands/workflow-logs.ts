import { type } from "arktype";
import { desc, eq } from "drizzle-orm";
import { CommandLifecycle } from "../command-lifecycle.js";
import {
	Command,
	type CommandDefinition,
	type CommandMetadata,
} from "../command-metadata.js";
import {
	getDb,
	runMigrations,
	workflowRunSteps,
	workflowRuns,
	workflows,
} from "../db/index.js";

// -----------------------------
// Flags
// -----------------------------
const workflowLogsFlags = type({
	"help?": "boolean",
	"run?": "string", // specific run ID (optional — defaults to latest)
});

type WorkflowLogsFlags = typeof workflowLogsFlags.infer;

// -----------------------------
// Metadata
// -----------------------------
const workflowLogsMetadata = {
	commandName: "workflow logs",
	description: "Show logs for the most recent run of a workflow",
	usage: "agentflow workflow logs <workflowId> [--run <runId>]",
	arguments: {
		workflowId: "The ID of the workflow",
	},
	flags: {
		run: "Show logs for a specific run ID instead of the latest",
		help: "Show help information",
	},
	examples: [
		"agentflow workflow logs abc123",
		"agentflow workflow logs abc123 --run run456",
	],
} satisfies CommandMetadata;

// -----------------------------
// Command
// -----------------------------
@Command(workflowLogsMetadata)
class WorkflowLogs extends CommandLifecycle<WorkflowLogsFlags> {
	protected override async run(): Promise<void> {
		const workflowId = this.args[0];
		if (!workflowId) {
			console.error("Error: <workflowId> argument is required.");
			console.error("Usage: agentflow workflow logs <workflowId>");
			process.exitCode = 1;
			return;
		}

		runMigrations();
		const db = getDb();

		const workflow = db
			.select({ id: workflows.id, name: workflows.name })
			.from(workflows)
			.where(eq(workflows.id, workflowId))
			.get();

		if (!workflow) {
			console.error(`Workflow not found: ${workflowId}`);
			process.exitCode = 1;
			return;
		}

		// Resolve which run to show.
		let run: typeof workflowRuns.$inferSelect | undefined;
		if (this.flags.run) {
			run = db
				.select()
				.from(workflowRuns)
				.where(eq(workflowRuns.id, this.flags.run))
				.get();
			if (!run) {
				console.error(`Run not found: ${this.flags.run}`);
				process.exitCode = 1;
				return;
			}
		} else {
			run = db
				.select()
				.from(workflowRuns)
				.where(eq(workflowRuns.workflowId, workflowId))
				.orderBy(desc(workflowRuns.startedAt))
				.get();
		}

		if (!run) {
			console.log(
				`No runs found for workflow: ${workflow.name} (${workflowId})`,
			);
			return;
		}

		const steps = db
			.select()
			.from(workflowRunSteps)
			.where(eq(workflowRunSteps.runId, run.id))
			.all();

		const startedLabel = run.startedAt
			? new Date(run.startedAt).toLocaleString()
			: "—";

		console.log(`\nRun ${run.id}  [${run.status}]  started: ${startedLabel}\n`);

		if (steps.length === 0) {
			console.log("  (no steps recorded)");
			return;
		}

		for (const step of steps) {
			const ts = step.startedAt ? new Date(step.startedAt).toISOString() : "—";
			const badge = step.status.padEnd(7);
			const logs = step.logs ? `\n    ${step.logs}` : "";
			console.log(`  [${ts}] [${badge}] ${step.stepName}${logs}`);
		}
		console.log();
	}
}

// -----------------------------
// Definition
// -----------------------------
export const workflowLogsCommandDefinition: CommandDefinition = {
	command: WorkflowLogs,
	metadata: workflowLogsMetadata,
	parseFlags: (flags) => {
		const result = workflowLogsFlags(flags);
		if (result instanceof type.errors) {
			throw new Error(`Invalid flags:\n${result.summary}`);
		}
		return result;
	},
} as const;
