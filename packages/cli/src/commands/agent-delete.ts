import { type } from "arktype";
import { eq } from "drizzle-orm";
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
const agentDeleteFlags = type({
	"help?": "boolean",
});

type AgentDeleteFlags = typeof agentDeleteFlags.infer;

// -----------------------------
// Metadata
// -----------------------------
const agentDeleteMetadata = {
	commandName: "agent delete",
	description: "Delete an agent from the local database",
	usage: "agentflow agent delete <id>",
	arguments: {
		id: "The ID of the agent to delete",
	},
	flags: {
		help: "Show help information",
	},
	examples: ["agentflow agent delete abc123"],
} satisfies CommandMetadata;

// -----------------------------
// Command
// -----------------------------
@Command(agentDeleteMetadata)
class AgentDelete extends CommandLifecycle<AgentDeleteFlags> {
	protected override async run(): Promise<void> {
		const id = this.args[0];
		if (!id) {
			console.error("Error: agent <id> argument is required.");
			console.error("Usage: agentflow agent delete <id>");
			process.exitCode = 1;
			return;
		}

		runMigrations();
		const db = getDb();

		const existing = db
			.select({ id: agents.id, name: agents.name })
			.from(agents)
			.where(eq(agents.id, id))
			.get();

		if (!existing) {
			console.error(`Agent not found: ${id}`);
			process.exitCode = 1;
			return;
		}

		db.delete(agents).where(eq(agents.id, id)).run();
		console.log(`✓ Agent deleted: ${id} (${existing.name})`);
	}
}

// -----------------------------
// Definition
// -----------------------------
export const agentDeleteCommandDefinition: CommandDefinition = {
	command: AgentDelete,
	metadata: agentDeleteMetadata,
	parseFlags: (flags) => {
		const result = agentDeleteFlags(flags);
		if (result instanceof type.errors) {
			throw new Error(`Invalid flags:\n${result.summary}`);
		}
		return result;
	},
} as const;
