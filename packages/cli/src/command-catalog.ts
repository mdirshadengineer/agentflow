import type { CommandDefinition } from "./command-metadata.js";
import { startCommandDefinition } from "./commands/start.js";
import { statusCommandDefinition } from "./commands/status.js";
import { stopCommandDefinition } from "./commands/stop.js";

const commandDefinitions = defineCommandCatalog([
	startCommandDefinition,
	statusCommandDefinition,
	stopCommandDefinition,
]);

const commandsByName = indexCommandsByName(commandDefinitions);

function defineCommandCatalog<
	const Definitions extends readonly CommandDefinition[],
>(definitions: Definitions): Definitions {
	return definitions;
}

function indexCommandsByName(
	definitions: readonly CommandDefinition[],
): ReadonlyMap<string, CommandDefinition> {
	const commandIndex = new Map<string, CommandDefinition>();

	for (const definition of definitions) {
		registerCommandName(
			commandIndex,
			definition.metadata.commandName,
			definition,
		);

		for (const alias of definition.metadata.aliases ?? []) {
			registerCommandName(commandIndex, alias, definition);
		}
	}

	return commandIndex;
}

function registerCommandName(
	commandIndex: Map<string, CommandDefinition>,
	commandName: string,
	definition: CommandDefinition,
): void {
	if (commandIndex.has(commandName)) {
		throw new Error(`Duplicate command registration for "${commandName}".`);
	}

	commandIndex.set(commandName, definition);
}

function getCommandDefinition(
	commandName: string,
): CommandDefinition | undefined {
	return commandsByName.get(commandName);
}

function getCommandDefinitions(): readonly CommandDefinition[] {
	return commandDefinitions;
}

export { getCommandDefinition, getCommandDefinitions };
