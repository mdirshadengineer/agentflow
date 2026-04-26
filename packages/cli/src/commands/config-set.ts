import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { type } from "arktype";
import { CommandLifecycle } from "../command-lifecycle.js";
import {
	Command,
	type CommandDefinition,
	type CommandMetadata,
} from "../command-metadata.js";
import { CONFIG_FILE_PATH } from "../global.config.js";

// Supported keys and their human-readable labels.
const ALLOWED_KEYS = ["port", "dataDir"] as const;
type ConfigKey = (typeof ALLOWED_KEYS)[number];

// -----------------------------
// Flags
// -----------------------------
const configSetCommandFlags = type({
	"help?": "boolean",
});

type ConfigSetCommandFlags = typeof configSetCommandFlags.infer;

// -----------------------------
// Metadata
// -----------------------------
const configSetCommandMetadata = {
	commandName: "config set",
	description: "Persist a configuration value to the agentflow config file",
	usage: "agentflow config set <key> <value>",
	arguments: {
		key: `Configuration key (${ALLOWED_KEYS.join(" | ")})`,
		value: "Value to persist",
	},
	flags: {
		help: "Show help information",
	},
	examples: [
		"agentflow config set port 3001",
		"agentflow config set dataDir /custom/path",
	],
} satisfies CommandMetadata;

// -----------------------------
// Helpers
// -----------------------------
function readConfigFile(): Record<string, unknown> {
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

function writeConfigFile(data: Record<string, unknown>): void {
	mkdirSync(dirname(CONFIG_FILE_PATH), { recursive: true });
	writeFileSync(CONFIG_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
}

// -----------------------------
// Command
// -----------------------------
@Command(configSetCommandMetadata)
class ConfigSet extends CommandLifecycle<ConfigSetCommandFlags> {
	protected override async run(): Promise<void> {
		const key = this.args[0] as ConfigKey | undefined;
		const value = this.args[1];

		if (!key || !value) {
			console.error(`Usage: agentflow config set <key> <value>`);
			console.error(`  Valid keys: ${ALLOWED_KEYS.join(", ")}`);
			process.exitCode = 1;
			return;
		}

		if (!(ALLOWED_KEYS as readonly string[]).includes(key)) {
			console.error(
				`Unknown config key: "${key}". Valid keys: ${ALLOWED_KEYS.join(", ")}`,
			);
			process.exitCode = 1;
			return;
		}

		if (key === "port") {
			const port = Number(value);
			if (!Number.isInteger(port) || port < 1 || port > 65535) {
				console.error(
					`Invalid port: "${value}". Must be an integer between 1 and 65535.`,
				);
				process.exitCode = 1;
				return;
			}
			// Persist port as a number for cleaner JSON.
			const existing = readConfigFile();
			writeConfigFile({ ...existing, port });
		} else {
			const existing = readConfigFile();
			writeConfigFile({ ...existing, [key]: value });
		}

		console.log(`✓ ${key} = ${value}`);
		console.log(`  Saved to: ${CONFIG_FILE_PATH}`);
		console.log("  Changes take effect on the next server start.");
	}
}

// -----------------------------
// Definition
// -----------------------------
export const configSetCommandDefinition: CommandDefinition = {
	command: ConfigSet,
	metadata: configSetCommandMetadata,
	parseFlags: (flags) => {
		const result = configSetCommandFlags(flags);
		if (result instanceof type.errors) {
			throw new Error(`Invalid flags:\n${result.summary}`);
		}
		return result;
	},
} as const;
