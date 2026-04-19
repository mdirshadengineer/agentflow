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
const statusCommandFlags = type({
	"json?": "boolean",
});

type StatusCommandFlags = typeof statusCommandFlags.infer;

// -----------------------------
// Metadata
// -----------------------------
const statusCommandMetadata = {
	commandName: "status",
	description: "Shows running agentflow processes",
	usage: "agentflow status [options]",
	flags: {
		json: "Output raw JSON",
	},
	examples: ["agentflow status", "agentflow status --json"],
} satisfies CommandMetadata;

// -----------------------------
// Command
// -----------------------------
@Command(statusCommandMetadata)
class Status extends CommandLifecycle<StatusCommandFlags> {
	private processManager = new ProcessManager();

	protected override async run(): Promise<void> {
		const processes = this.processManager.list();

		if (processes.length === 0) {
			console.log("No running processes found.");
			return;
		}

		if (this.flags.json) {
			console.log(JSON.stringify(processes, null, 2));
			return;
		}

		console.log("\nAgentflow Processes:\n");

		for (const p of processes) {
			console.log(
				`• ${p.id}\n` +
					`  PID: ${p.pid}\n` +
					`  Uptime: ${formatUptime(p.startedAt)}\n`,
			);
		}
	}
}

// -----------------------------
// Utils
// -----------------------------
function formatUptime(startedAt: number): string {
	const diff = Date.now() - startedAt;

	const sec = Math.floor(diff / 1000) % 60;
	const min = Math.floor(diff / (1000 * 60)) % 60;
	const hr = Math.floor(diff / (1000 * 60 * 60));

	return `${hr}h ${min}m ${sec}s`;
}

// -----------------------------
// Definition
// -----------------------------
export const statusCommandDefinition: CommandDefinition = {
	command: Status,
	metadata: statusCommandMetadata,
	parseFlags: (flags) => {
		const result = statusCommandFlags(flags);
		if (result instanceof type.errors) {
			throw new Error(`Invalid flags:\n${result.summary}`);
		}
		return result;
	},
} as const;
