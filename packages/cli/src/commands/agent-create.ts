import { randomUUID } from "node:crypto";
import { type } from "arktype";
import { eq } from "drizzle-orm";
import { CommandLifecycle } from "../command-lifecycle.js";
import {
	Command,
	type CommandDefinition,
	type CommandMetadata,
} from "../command-metadata.js";
import { agents, getDb, runMigrations, users } from "../db/index.js";

// -----------------------------
// Flags
// -----------------------------
const agentCreateFlags = type({
	"help?": "boolean",
	"name?": "string",
	"type?": "string",
	"description?": "string",
	"config?": "string", // JSON string
	"json?": "boolean",
});

type AgentCreateFlags = typeof agentCreateFlags.infer;

// -----------------------------
// Metadata
// -----------------------------
const agentCreateMetadata = {
	commandName: "agent create",
	description: "Create a new agent in the local database",
	usage: "agentflow agent create --name <name> --type <type> [options]",
	flags: {
		name: "Agent name (required)",
		type: "Agent type (required)",
		description: "Agent description",
		config: "Agent config as a JSON string",
		json: "Output the created agent as JSON",
		help: "Show help information",
	},
	examples: [
		'agentflow agent create --name "My Agent" --type llm',
		'agentflow agent create --name "Bot" --type rpa --config \'{"model":"gpt-4"}\'',
	],
} satisfies CommandMetadata;

// -----------------------------
// Command
// -----------------------------
@Command(agentCreateMetadata)
class AgentCreate extends CommandLifecycle<AgentCreateFlags> {
	protected override async run(): Promise<void> {
		const {
			name,
			type: agentType,
			description,
			config: configStr,
			json,
		} = this.flags;

		if (!name) {
			console.error("Error: --name is required.");
			process.exitCode = 1;
			return;
		}

		if (!agentType) {
			console.error("Error: --type is required.");
			process.exitCode = 1;
			return;
		}

		let parsedConfig: unknown = {};
		if (configStr) {
			try {
				parsedConfig = JSON.parse(configStr);
			} catch {
				console.error("Error: --config must be valid JSON.");
				process.exitCode = 1;
				return;
			}
		}

		runMigrations();
		const db = getDb();

		// Use the first registered user as the owner.
		const owner = db.select({ id: users.id }).from(users).get();
		if (!owner) {
			console.error(
				"No user account found. Start the server with 'agentflow start' and sign up via the web UI first.",
			);
			process.exitCode = 1;
			return;
		}

		const id = randomUUID();
		const now = Date.now();

		db.insert(agents)
			.values({
				id,
				name,
				description: description ?? null,
				type: agentType,
				config: JSON.stringify(parsedConfig),
				ownerId: owner.id,
				createdAt: new Date(now),
				updatedAt: new Date(now),
			})
			.run();

		const created = db.select().from(agents).where(eq(agents.id, id)).get();
		if (!created) {
			console.error("Failed to create agent.");
			process.exitCode = 1;
			return;
		}

		if (json) {
			console.log(JSON.stringify(created, null, 2));
			return;
		}

		console.log(`✓ Agent created: ${created.id}`);
		console.log(`  Name: ${created.name}`);
		console.log(`  Type: ${created.type}`);
	}
}

// -----------------------------
// Definition
// -----------------------------
export const agentCreateCommandDefinition: CommandDefinition = {
	command: AgentCreate,
	metadata: agentCreateMetadata,
	parseFlags: (flags) => {
		const result = agentCreateFlags(flags);
		if (result instanceof type.errors) {
			throw new Error(`Invalid flags:\n${result.summary}`);
		}
		return result;
	},
} as const;
