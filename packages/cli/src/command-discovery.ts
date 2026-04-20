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

	public discover() {
		if (this.showGlobalHelp) {
			printGlobalHelp(getCommandDefinitions());
			return;
		}

		const definition = getCommandDefinition(this.commandName);
		if (!definition) {
			console.error(`Command "${this.commandName}" not found.`);
			printGlobalHelp(getCommandDefinitions());
			return;
		}

		const commandContext = parseCommandContext(process.argv.slice(3)); // slice(3) skips node, script, and command name
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
