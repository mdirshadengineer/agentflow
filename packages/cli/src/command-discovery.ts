import { container, injectable } from "tsyringe";
import {
	getCommandDefinition,
	getCommandDefinitions,
} from "./command-catalog.js";
import { type CommandContext, parseCommandContext } from "./command-context.js";
import { printCommandHelp, printGlobalHelp } from "./command-help-renderer.js";
import type { CommandDefinition } from "./command-metadata.js";
import { AGENTFLOW_DEFAULT_COMMAND } from "./global.config.js";

@injectable()
class CommandDiscovery {
	private commandName: string;
	private showGlobalHelp: boolean = false;

	constructor() {
		this.commandName = process.argv[2] || AGENTFLOW_DEFAULT_COMMAND;
		if (this.commandName === "--help" || this.commandName === "-h") {
			this.showGlobalHelp = true;
		}
	}

	public async discover() {
		if (this.showGlobalHelp) {
			printGlobalHelp(getCommandDefinitions());
			return 0;
		}

		// Support compound commands: "agentflow <group> <subcommand> [flags…]"
		// e.g. "agentflow agent list", "agentflow config set"
		// If the token after the group name looks like a subcommand (no leading
		// dash) and a compound key is registered in the catalog, use it and
		// advance the args slice one position further.
		const nextArg = process.argv[3];
		let resolvedName = this.commandName;
		let argsSliceStart = 3; // default: skip node, script, command

		if (nextArg && !nextArg.startsWith("-")) {
			const compound = `${this.commandName} ${nextArg}`;
			if (getCommandDefinition(compound)) {
				resolvedName = compound;
				argsSliceStart = 4; // also skip the subcommand token
			}
		}

		const definition = getCommandDefinition(resolvedName);
		if (!definition) {
			console.error(`Command "${resolvedName}" not found.`);
			printGlobalHelp(getCommandDefinitions());
			return 1;
		}

		const commandContext = parseCommandContext(
			process.argv.slice(argsSliceStart),
		);
		return this.executeCommand(definition, commandContext);
	}

	private async executeCommand<Flags extends Record<string, unknown>>(
		definition: CommandDefinition<Flags>,
		context: CommandContext,
	): Promise<number> {
		let flags: Flags;
		try {
			flags = definition.parseFlags
				? definition.parseFlags(context.flags)
				: (context.flags as Flags);
		} catch (error) {
			console.error(
				`Invalid flags for command "${definition.metadata.commandName}": ${this.formatError(error)}`,
			);
			printCommandHelp(definition.metadata);
			return 1;
		}

		if (flags.help === true) {
			printCommandHelp(definition.metadata);
			return 0;
		}

		try {
			const command = container.resolve(definition.command);
			command.args = context.args;
			command.flags = flags;
			await command.execute();
			return 0;
		} catch (error) {
			console.error(
				`Command "${definition.metadata.commandName}" failed: ${this.formatError(error)}`,
			);
			return 1;
		}
	}

	private formatError(error: unknown): string {
		if (error instanceof Error) {
			return error.message;
		}
		return String(error);
	}
}

export { CommandDiscovery };
