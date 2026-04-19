import { type } from "arktype";
import { CommandLifecycle } from "../command-lifecycle.js";
import {
	Command,
	type CommandDefinition,
	type CommandMetadata,
} from "../command-metadata.js";
import { ProcessManager } from "../process/process-manager.js";
import { runtime } from "../runtime/index.js";

// -----------------------------
// Flags
// -----------------------------
const startCommandFlags = type({
	"help?": "boolean",
	"detach?": "boolean",
});

type StartCommandFlags = typeof startCommandFlags.infer;

// -----------------------------
// Metadata
// -----------------------------
const startCommandMetadata = {
	commandName: "start",
	description: "Starts the agentflow application",
	usage: "agentflow start [options]",
	flags: {
		help: "Show help information",
		detach: "Run in background",
	},
	aliases: ["run", "serve"],
	examples: ["agentflow start", "agentflow start --detach"],
} satisfies CommandMetadata;

// -----------------------------
// Command
// -----------------------------
@Command(startCommandMetadata)
class Start extends CommandLifecycle<StartCommandFlags> {
	private processManager = new ProcessManager();

	protected override async run(): Promise<void> {
		if (this.flags.detach) {
			this.runDetached();
			return;
		}

		// Foreground mode (unchanged)
		await runtime.start();
		console.log("Application started successfully.");

		this.setupProcessHandlers();
		this.setupExitHandlers();

		await this.waitUntilShutdown();
	}

	// -----------------------------
	// Detached Mode (delegated)
	// -----------------------------
	private runDetached(): void {
		const args = process.argv.slice(1); // pass original args

		const pid = this.processManager.startDetached(args);

		console.log(`Application started in detached mode (pid: ${pid}).`);
	}

	// -----------------------------
	// Shutdown Barrier
	// -----------------------------
	private shutdownPromise?: Promise<void>;
	private resolveShutdown?: () => void;

	private waitUntilShutdown(): Promise<void> {
		if (!this.shutdownPromise) {
			this.shutdownPromise = new Promise<void>((resolve) => {
				this.resolveShutdown = resolve;
			});
		}
		return this.shutdownPromise;
	}

	private signalShutdown(): void {
		this.resolveShutdown?.();
	}

	// -----------------------------
	// Process Signals
	// -----------------------------
	protected setupProcessHandlers(): void {
		const shutdown = async () => {
			try {
				console.log("Shutting down...");
				await runtime.stop();
			} catch (err) {
				console.error("Error during shutdown:", err);
			} finally {
				process.exitCode = 0;
				this.signalShutdown();
			}
		};

		process.once("SIGINT", shutdown);
		process.once("SIGTERM", shutdown);
	}

	// -----------------------------
	// Fatal Error Handling
	// -----------------------------
	protected setupExitHandlers(): void {
		process.once("uncaughtException", async (error) => {
			console.error("Uncaught exception:", error);

			try {
				await runtime.stop();
			} finally {
				process.exitCode = 1;
				this.signalShutdown();
			}
		});

		process.once("unhandledRejection", async (reason) => {
			console.error("Unhandled rejection:", reason);

			try {
				await runtime.stop();
			} finally {
				process.exitCode = 1;
				this.signalShutdown();
			}
		});
	}
}

// -----------------------------
// Definition
// -----------------------------
export const startCommandDefinition: CommandDefinition = {
	command: Start,
	metadata: startCommandMetadata,
	parseFlags: (flags) => {
		const result = startCommandFlags(flags);
		if (result instanceof type.errors) {
			throw new Error(`Invalid flags:\n${result.summary}`);
		}
		return result;
	},
} as const;