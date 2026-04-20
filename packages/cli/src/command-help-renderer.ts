import type { CommandDefinition, CommandMetadata } from "./command-metadata.js";

export function printGlobalHelp(
	definitions: readonly CommandDefinition[],
): void {
	console.log("AgentFlow CLI - Automate. Innovate. Collaborate.");
	console.log("");
	console.log("A powerful CLI tool to manage your AgentFlow projects.");
	console.log("");
	console.log("Usage: agentflow <command> [options]");
	console.log("");
	console.log("Available commands:");

	for (const definition of definitions) {
		const aliasSuffix = definition.metadata.aliases?.length
			? ` (aliases: ${definition.metadata.aliases.join(", ")})`
			: "";
		console.log(
			`  ${definition.metadata.commandName}${aliasSuffix} - ${definition.metadata.description}`,
		);
	}
}

export function printCommandHelp(metadata: CommandMetadata): void {
	console.log(`Usage: ${metadata.usage}`);
	console.log("");
	console.log(metadata.description);
	console.log("");
	if (metadata.aliases?.length) {
		console.log(`Aliases: ${metadata.aliases.join(", ")}`);
		console.log("");
	}

	if (metadata.flags && Object.keys(metadata.flags).length > 0) {
		console.log("Flags:");
		for (const [flag, description] of Object.entries(metadata.flags)) {
			console.log(`  --${flag}: ${description}`);
		}
		console.log("");
	}

	if (metadata.arguments && Object.keys(metadata.arguments).length > 0) {
		console.log("Arguments:");
		for (const [argument, description] of Object.entries(metadata.arguments)) {
			console.log(`  ${argument}: ${description}`);
		}
		console.log("");
	}

	if (metadata.examples?.length) {
		console.log("Examples:");
		for (const example of metadata.examples) {
			console.log(`  ${example}`);
		}
	}
}
