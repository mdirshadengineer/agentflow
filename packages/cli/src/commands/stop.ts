import { type } from "arktype";
import { CommandLifecycle } from "../command-lifecycle.js";
import {
	Command,
	type CommandDefinition,
	type CommandMetadata,
} from "../command-metadata.js";
import { ProcessManager } from "../process/process-manager.js";

// -----------------------------
// Flags
// -----------------------------
const stopCommandFlags = type({
	"id?": "string",
	"force?": "boolean",
	"help?": "boolean",
});

type StopCommandFlags = typeof stopCommandFlags.infer;

// -----------------------------
// Metadata
// -----------------------------
const stopCommandMetadata = {
	commandName: "stop",
	description: "Stops a running agentflow process",
	usage: "agentflow stop [options]",
	flags: {
		id: "Process id (default: 'default')",
		force: "Force kill (SIGKILL)",
	},
	examples: [
		"agentflow stop",
		"agentflow stop --id default",
		"agentflow stop --force",
	],
} satisfies CommandMetadata;

// -----------------------------
// Command
// -----------------------------
@Command(stopCommandMetadata)
class Stop extends CommandLifecycle<StopCommandFlags> {
	private processManager = new ProcessManager();

	protected override async run(): Promise<void> {
		const id = this.flags.id ?? "default";
		const force = this.flags.force ?? false;

		try {
			console.log(
				force
					? `Force stopping process "${id}"...`
					: `Stopping process "${id}"...`,
			);

			await this.processManager.stop(id, force);

			console.log(`Process "${id}" stopped successfully.`);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);

			console.error(`Failed to stop process "${id}": ${message}`);
			process.exitCode = 1;
		}
	}
}

// -----------------------------
// Definition
// -----------------------------
export const stopCommandDefinition: CommandDefinition = {
	command: Stop,
	metadata: stopCommandMetadata,
	parseFlags: (flags) => {
		const result = stopCommandFlags(flags);
		if (result instanceof type.errors) {
			throw new Error(`Invalid flags:\n${result.summary}`);
		}
		return result;
	},
} as const;
