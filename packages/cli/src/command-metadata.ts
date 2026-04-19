import { injectable } from "tsyringe";
import type { CommandLifecycle } from "./command-lifecycle.js";

const commandMetadataKey = Symbol("command-metadata"); // Unique symbol to store command metadata and avoid naming collisions.

export interface CommandMetadata {
	commandName: string;
	description: string;
	usage: string;
	aliases?: string[];
	examples?: string[];
	flags?: Record<string, string>;
	arguments?: Record<string, string>;
}

type MetadataCarrier = {
	[commandMetadataKey]?: CommandMetadata;
};

export type CommandClass<
	Flags extends Record<string, unknown> = Record<string, unknown>,
> = (new () => CommandLifecycle<Flags>) & MetadataCarrier;

interface CommandDefinition<
	Flags extends Record<string, unknown> = Record<string, unknown>,
> {
	command: CommandClass<Flags>;
	metadata: CommandMetadata;
	parseFlags?(args: Record<string, unknown>): Flags;
}

function Command(metadata: CommandMetadata) {
	return <T extends CommandClass>(target: T): T => {
		target[commandMetadataKey] = metadata;

		injectable()(target);
		return target;
	};
}

function getCommandMetadata(target: CommandClass): CommandMetadata | undefined {
	return target[commandMetadataKey];
}

export { Command, type CommandDefinition, getCommandMetadata };
