import { type } from "arktype";
import { CommandLifecycle } from "../command-lifecycle.js";
import {
	Command,
	type CommandDefinition,
	type CommandMetadata,
} from "../command-metadata.js";
import { agents, getDb, runMigrations } from "../db/index.js";

// -----------------------------
// Flags
// -----------------------------
const agentListFlags = type({
	"help?": "boolean",
	"json?": "boolean",
});

type AgentListFlags = typeof agentListFlags.infer;

// -----------------------------
// Metadata
// -----------------------------
const agentListMetadata = {
	commandName: "agent list",
	description: "List all agents stored in the local database",
	usage: "agentflow agent list [--json]",
	flags: {
		json: "Output raw JSON",
		help: "Show help information",
	},
	examples: ["agentflow agent list", "agentflow agent list --json"],
} satisfies CommandMetadata;

// -----------------------------
// Command
// -----------------------------
@Command(agentListMetadata)
class AgentList extends CommandLifecycle<AgentListFlags> {
	protected override async run(): Promise<void> {
		runMigrations();
		const db = getDb();
		const rows = db.select().from(agents).all();

		if (rows.length === 0) {
			console.log("No agents found.");
			return;
		}

		if (this.flags.json) {
			console.log(JSON.stringify(rows, null, 2));
			return;
		}

		console.log(`\nAgents (${rows.length}):\n`);
		for (const agent of rows) {
			console.log(`• ${agent.id}`);
			console.log(`  Name:    ${agent.name}`);
			console.log(`  Type:    ${agent.type}`);
			if (agent.description) console.log(`  Desc:    ${agent.description}`);
			console.log(`  Created: ${new Date(agent.createdAt).toLocaleString()}\n`);
		}
	}
}

// -----------------------------
// Definition
// -----------------------------
export const agentListCommandDefinition: CommandDefinition = {
	command: AgentList,
	metadata: agentListMetadata,
	parseFlags: (flags) => {
		const result = agentListFlags(flags);
		if (result instanceof type.errors) {
			throw new Error(`Invalid flags:\n${result.summary}`);
		}
		return result;
	},
} as const;
