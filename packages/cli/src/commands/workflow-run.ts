import { randomUUID } from "node:crypto";
import { type } from "arktype";
import { eq } from "drizzle-orm";
import { CommandLifecycle } from "../command-lifecycle.js";
import {
	Command,
	type CommandDefinition,
	type CommandMetadata,
} from "../command-metadata.js";
import { getDb, runMigrations, workflowRuns, workflows } from "../db/index.js";

// -----------------------------
// Flags
// -----------------------------
const workflowRunFlags = type({
	"help?": "boolean",
	"json?": "boolean",
});

type WorkflowRunFlags = typeof workflowRunFlags.infer;

// -----------------------------
// Metadata
// -----------------------------
const workflowRunMetadata = {
	commandName: "workflow run",
	description: "Enqueue a new run for a workflow",
	usage: "agentflow workflow run <workflowId>",
	arguments: {
		workflowId: "The ID of the workflow to run",
	},
	flags: {
		json: "Output the created run as JSON",
		help: "Show help information",
	},
	examples: ["agentflow workflow run abc123"],
} satisfies CommandMetadata;

// -----------------------------
// Command
// -----------------------------
@Command(workflowRunMetadata)
class WorkflowRun extends CommandLifecycle<WorkflowRunFlags> {
	protected override async run(): Promise<void> {
		const workflowId = this.args[0];
		if (!workflowId) {
			console.error("Error: <workflowId> argument is required.");
			console.error("Usage: agentflow workflow run <workflowId>");
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

		const runId = randomUUID();
		db.insert(workflowRuns)
			.values({ id: runId, workflowId, status: "queued" })
			.run();

		const run = db
			.select()
			.from(workflowRuns)
			.where(eq(workflowRuns.id, runId))
			.get();

		if (!run) {
			console.error("Failed to enqueue workflow run.");
			process.exitCode = 1;
			return;
		}

		if (this.flags.json) {
			console.log(JSON.stringify(run, null, 2));
			return;
		}

		console.log(`✓ Run enqueued: ${run.id}`);
		console.log(`  Workflow: ${workflow.name} (${workflowId})`);
		console.log(`  Status:   ${run.status}`);
		console.log(
			"\nThe run will be picked up by the worker when the server is running.",
		);
	}
}

// -----------------------------
// Definition
// -----------------------------
export const workflowRunCommandDefinition: CommandDefinition = {
	command: WorkflowRun,
	metadata: workflowRunMetadata,
	parseFlags: (flags) => {
		const result = workflowRunFlags(flags);
		if (result instanceof type.errors) {
			throw new Error(`Invalid flags:\n${result.summary}`);
		}
		return result;
	},
} as const;
