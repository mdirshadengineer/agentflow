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
} from "../db/index.js";

// -----------------------------
// Flags
// -----------------------------
const logsCommandFlags = type({
	"help?": "boolean",
	"follow?": "boolean",
	"limit?": "number",
});

type LogsCommandFlags = typeof logsCommandFlags.infer;

// -----------------------------
// Metadata
// -----------------------------
const logsCommandMetadata = {
	commandName: "logs",
	description: "Tail recent workflow run logs from the local database",
	usage: "agentflow logs [--follow] [--limit <n>]",
	flags: {
		follow: "Keep polling for new log entries (Ctrl+C to stop)",
		limit: "Number of most-recent step entries to show (default: 50)",
		help: "Show help information",
	},
	examples: [
		"agentflow logs",
		"agentflow logs --follow",
		"agentflow logs --limit 20",
	],
} satisfies CommandMetadata;

// -----------------------------
// Helpers
// -----------------------------
type StepRow = {
	stepId: string;
	runId: string;
	workflowId: string;
	stepName: string;
	status: string;
	logs: string | null;
	startedAt: Date | null;
};

function queryRecentSteps(
	db: ReturnType<typeof getDb>,
	limit: number,
): StepRow[] {
	return db
		.select({
			stepId: workflowRunSteps.id,
			runId: workflowRunSteps.runId,
			workflowId: workflowRuns.workflowId,
			stepName: workflowRunSteps.stepName,
			status: workflowRunSteps.status,
			logs: workflowRunSteps.logs,
			startedAt: workflowRunSteps.startedAt,
		})
		.from(workflowRunSteps)
		.innerJoin(workflowRuns, eq(workflowRunSteps.runId, workflowRuns.id))
		.orderBy(desc(workflowRunSteps.startedAt))
		.limit(limit)
		.all() as StepRow[];
}

function printStep(step: StepRow): void {
	const ts = step.startedAt ? new Date(step.startedAt).toISOString() : "—";
	const badge = step.status.padEnd(7);
	const logLine = step.logs ? `  ${step.logs}` : "";
	console.log(
		`[${ts}] [${badge}] run:${step.runId.slice(0, 8)}  ${step.stepName}${logLine}`,
	);
}

// -----------------------------
// Command
// -----------------------------
@Command(logsCommandMetadata)
class Logs extends CommandLifecycle<LogsCommandFlags> {
	protected override async run(): Promise<void> {
		const limit = this.flags.limit ?? 50;
		const follow = this.flags.follow ?? false;

		runMigrations();
		const db = getDb();

		// Print initial batch
		const initial = queryRecentSteps(db, limit);
		if (initial.length === 0 && !follow) {
			console.log("No workflow run logs found.");
			return;
		}
		// Print in chronological order (oldest first for readability)
		for (const step of initial.slice().reverse()) {
			printStep(step);
		}

		if (!follow) return;

		// Track already-printed step IDs
		const printed = new Set(initial.map((s) => s.stepId));

		console.log("\n(Following new log entries — press Ctrl+C to stop)\n");

		process.once("SIGINT", () => {
			console.log("\n(stopped)");
			process.exit(0);
		});

		// Poll for new entries every second
		setInterval(() => {
			const fresh = queryRecentSteps(db, limit);
			for (const step of fresh.slice().reverse()) {
				if (!printed.has(step.stepId)) {
					printStep(step);
					printed.add(step.stepId);
				}
			}
		}, 1000);

		// Keep the process alive
		await new Promise<void>(() => {
			// Resolved only by the SIGINT handler above.
		});
	}
}

// -----------------------------
// Definition
// -----------------------------
export const logsCommandDefinition: CommandDefinition = {
	command: Logs,
	metadata: logsCommandMetadata,
	parseFlags: (flags) => {
		const result = logsCommandFlags(flags);
		if (result instanceof type.errors) {
			throw new Error(`Invalid flags:\n${result.summary}`);
		}
		return result;
	},
} as const;
