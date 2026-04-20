interface CommandContext {
	// Define properties and methods for the command context here, e.g.:
	args: readonly string[];
	flags: Record<string, unknown>;
}

function coerceValue(raw: string): unknown {
	if (raw === "true") return true;
	if (raw === "false") return false;
	const num = Number(raw);
	if (raw !== "" && !Number.isNaN(num)) return num;
	return raw;
}

function parseCommandContext(argv: readonly string[]): CommandContext {
	const args: string[] = [];
	const flags: Record<string, unknown> = {};
	let parsingFlags = true;

	for (let index = 0; index < argv.length; index += 1) {
		const token = argv[index];
		if (!token) {
			continue;
		}

		if (parsingFlags && token === "--") {
			parsingFlags = false;
			continue;
		}

		if (!parsingFlags || !token.startsWith("--")) {
			args.push(token);
			continue;
		}

		const [flagName, inlineValue] = token.slice(2).split("=", 2);
		if (!flagName) {
			continue;
		}

		if (inlineValue !== undefined) {
			flags[flagName] = coerceValue(inlineValue);
			continue;
		}

		const nextToken = argv[index + 1];
		if (nextToken && !nextToken.startsWith("--")) {
			flags[flagName] = coerceValue(nextToken);
			index += 1;
			continue;
		}

		flags[flagName] = true;
	}

	return { args, flags };
}

export { type CommandContext, parseCommandContext };
