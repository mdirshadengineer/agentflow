import { existsSync, readFileSync } from "node:fs";
import { type } from "arktype";
import { CommandLifecycle } from "../command-lifecycle.js";
import {
	Command,
	type CommandDefinition,
	type CommandMetadata,
} from "../command-metadata.js";
import {
	AGENTFLOW_API_SERVER_PORT,
	AGENTFLOW_DATA_DIR,
	CONFIG_FILE_PATH,
} from "../global.config.js";

// -----------------------------
// Flags
// -----------------------------
const configCommandFlags = type({
	"help?": "boolean",
	"json?": "boolean",
});

type ConfigCommandFlags = typeof configCommandFlags.infer;

// -----------------------------
// Metadata
// -----------------------------
const configCommandMetadata = {
	commandName: "config",
	description: "Show the current agentflow configuration",
	usage: "agentflow config [--json]",
	flags: {
		json: "Output configuration as JSON",
		help: "Show help information",
	},
	examples: [
		"agentflow config",
		"agentflow config --json",
		"agentflow config set port 3001",
		"agentflow config set dataDir /custom/path",
	],
} satisfies CommandMetadata;

// -----------------------------
// Helpers
// -----------------------------
function resolveSource(
	envKey: string,
	fileValue: unknown,
): "env" | "file" | "default" {
	if (process.env[envKey] !== undefined) return "env";
	if (fileValue !== undefined) return "file";
	return "default";
}

function loadPersistentConfig(): Record<string, unknown> {
	if (!existsSync(CONFIG_FILE_PATH)) return {};
	try {
		return JSON.parse(readFileSync(CONFIG_FILE_PATH, "utf-8")) as Record<
			string,
			unknown
		>;
	} catch {
		return {};
	}
}

// -----------------------------
// Command
// -----------------------------
@Command(configCommandMetadata)
class Config extends CommandLifecycle<ConfigCommandFlags> {
	protected override async run(): Promise<void> {
		const fileConfig = loadPersistentConfig();

		const config = {
			port: {
				value: AGENTFLOW_API_SERVER_PORT,
				envVar: "AGENTFLOW_PORT",
				source: resolveSource("AGENTFLOW_PORT", fileConfig["port"]),
			},
			dataDir: {
				value: AGENTFLOW_DATA_DIR,
				envVar: "AGENTFLOW_DATA_DIR",
				source: resolveSource("AGENTFLOW_DATA_DIR", fileConfig["dataDir"]),
			},
			configFile: {
				value: CONFIG_FILE_PATH,
				envVar: null,
				source: "fixed" as const,
			},
		};

		if (this.flags.json) {
			console.log(
				JSON.stringify(
					{
						port: config.port.value,
						dataDir: config.dataDir.value,
						configFile: config.configFile.value,
					},
					null,
					2,
				),
			);
			return;
		}

		const src = (s: string) => `(${s})`;

		console.log("\nAgentflow Configuration:\n");
		console.log(
			`  port        ${config.port.value}  ${src(config.port.source)}`,
		);
		console.log(
			`  dataDir     ${config.dataDir.value}  ${src(config.dataDir.source)}`,
		);
		console.log(`  configFile  ${config.configFile.value}  ${src("fixed")}`);
		console.log();
		console.log("Override at runtime:  AGENTFLOW_PORT=<n>  AGENTFLOW_DATA_DIR=<path>");
		console.log("Persist a value:      agentflow config set port <n>");
		console.log("                      agentflow config set dataDir <path>\n");
	}
}

// -----------------------------
// Definition
// -----------------------------
export const configCommandDefinition: CommandDefinition = {
	command: Config,
	metadata: configCommandMetadata,
	parseFlags: (flags) => {
		const result = configCommandFlags(flags);
		if (result instanceof type.errors) {
			throw new Error(`Invalid flags:\n${result.summary}`);
		}
		return result;
	},
} as const;
