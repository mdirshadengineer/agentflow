import { type } from "arktype";
import { CommandLifecycle } from "../command-lifecycle.js";
import {
	Command,
	type CommandDefinition,
	type CommandMetadata,
} from "../command-metadata.js";
import { getDb, runMigrations, workflows } from "../db/index.js";

// -----------------------------
// Flags
// -----------------------------
const workflowListFlags = type({
	"help?": "boolean",
	"json?": "boolean",
});

type WorkflowListFlags = typeof workflowListFlags.infer;

// -----------------------------
// Metadata
// -----------------------------
const workflowListMetadata = {
	commandName: "workflow list",
	description: "List all workflows stored in the local database",
	usage: "agentflow workflow list [--json]",
	flags: {
		json: "Output raw JSON",
		help: "Show help information",
	},
	examples: ["agentflow workflow list", "agentflow workflow list --json"],
} satisfies CommandMetadata;

// -----------------------------
// Command
// -----------------------------
@Command(workflowListMetadata)
class WorkflowList extends CommandLifecycle<WorkflowListFlags> {
	protected override async run(): Promise<void> {
		runMigrations();
		const db = getDb();
		const rows = db
			.select({ id: workflows.id, name: workflows.name, updatedAt: workflows.updatedAt })
			.from(workflows)
			.all();

		if (rows.length === 0) {
			console.log("No workflows found.");
			return;
		}

		if (this.flags.json) {
			console.log(JSON.stringify(rows, null, 2));
			return;
		}

		console.log(`\nWorkflows (${rows.length}):\n`);
		for (const wf of rows) {
			console.log(`• ${wf.id}`);
			console.log(`  Name:    ${wf.name}`);
			console.log(
				`  Updated: ${new Date(wf.updatedAt).toLocaleString()}\n`,
			);
		}
	}
}

// -----------------------------
// Definition
// -----------------------------
export const workflowListCommandDefinition: CommandDefinition = {
	command: WorkflowList,
	metadata: workflowListMetadata,
	parseFlags: (flags) => {
		const result = workflowListFlags(flags);
		if (result instanceof type.errors) {
			throw new Error(`Invalid flags:\n${result.summary}`);
		}
		return result;
	},
} as const;
