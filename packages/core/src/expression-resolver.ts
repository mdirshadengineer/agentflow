import type { ExprAst, NodeOutput, PathSegment, TemplateAst } from "./types.js";

interface ParserState {
	source: string;
	index: number;
}

interface StepReference {
	stepId: string;
	port: string;
	path: PathSegment[];
}

function createParser(source: string): ParserState {
	return { source, index: 0 };
}

function isIdentifierStart(char: string | undefined): boolean {
	return char !== undefined && /[A-Za-z_]/.test(char);
}

function isIdentifierPart(char: string | undefined): boolean {
	return char !== undefined && /[A-Za-z0-9_-]/.test(char);
}

function peek(parser: ParserState, offset = 0): string | undefined {
	return parser.source[parser.index + offset];
}

function consume(parser: ParserState, expected?: string): string {
	const char = parser.source[parser.index];
	if (char === undefined) {
		throw new Error("Unexpected end of expression");
	}
	if (expected !== undefined && char !== expected) {
		throw new Error(`Expected "${expected}" but found "${char}"`);
	}
	parser.index += 1;
	return char;
}

function skipWhitespace(parser: ParserState): void {
	while (peek(parser)?.match(/\s/)) parser.index += 1;
}

function parseIdentifier(parser: ParserState): string {
	const start = peek(parser);
	if (!isIdentifierStart(start)) {
		throw new Error(`Expected identifier at position ${parser.index}`);
	}
	let value = consume(parser);
	while (isIdentifierPart(peek(parser))) {
		value += consume(parser);
	}
	return value;
}

function parseReferenceSegment(parser: ParserState): string {
	let value = "";
	while (true) {
		const char = peek(parser);
		if (char === undefined || char === "." || char.match(/\s/)) break;
		value += consume(parser);
	}
	if (value.length === 0) {
		throw new Error(`Expected reference segment at position ${parser.index}`);
	}
	return value;
}

function parseStringLiteral(parser: ParserState): string {
	const quote = consume(parser);
	let value = "";
	while (true) {
		const char = consume(parser);
		if (char === quote) return value;
		if (char === "\\") {
			const escaped = consume(parser);
			value += escaped === "n" ? "\n" : escaped === "t" ? "\t" : escaped;
			continue;
		}
		value += char;
	}
}

function parseNumberLiteral(parser: ParserState): number {
	let raw = "";
	if (peek(parser) === "-") raw += consume(parser);
	while (peek(parser)?.match(/[0-9]/)) raw += consume(parser);
	if (peek(parser) === ".") {
		raw += consume(parser);
		while (peek(parser)?.match(/[0-9]/)) raw += consume(parser);
	}
	const value = Number(raw);
	if (!Number.isFinite(value)) {
		throw new Error(`Invalid number literal "${raw}"`);
	}
	return value;
}

function parseLiteral(parser: ParserState): ExprAst | null {
	const char = peek(parser);
	if (char === '"' || char === "'") {
		return { kind: "Literal", value: parseStringLiteral(parser) };
	}
	if (char?.match(/[0-9-]/)) {
		return { kind: "Literal", value: parseNumberLiteral(parser) };
	}
	const remaining = parser.source.slice(parser.index);
	if (remaining.startsWith("true")) {
		parser.index += 4;
		return { kind: "Literal", value: true };
	}
	if (remaining.startsWith("false")) {
		parser.index += 5;
		return { kind: "Literal", value: false };
	}
	if (remaining.startsWith("null")) {
		parser.index += 4;
		return { kind: "Literal", value: null };
	}
	return null;
}

function parsePath(parser: ParserState): PathSegment[] {
	const path: PathSegment[] = [];
	while (true) {
		skipWhitespace(parser);
		if (peek(parser) === "?" && peek(parser, 1) === ".") {
			consume(parser, "?");
			consume(parser, ".");
			path.push(parseIdentifier(parser));
			continue;
		}
		if (peek(parser) === ".") {
			consume(parser, ".");
			path.push(parseIdentifier(parser));
			continue;
		}
		if (peek(parser) === "[") {
			consume(parser, "[");
			skipWhitespace(parser);
			const next = peek(parser);
			if (next === '"' || next === "'") {
				path.push(parseStringLiteral(parser));
			} else {
				path.push(parseNumberLiteral(parser));
			}
			skipWhitespace(parser);
			consume(parser, "]");
			continue;
		}
		break;
	}
	return path;
}

function parseCall(parser: ParserState, fn: string): ExprAst {
	consume(parser, "(");
	const args: ExprAst[] = [];
	while (true) {
		skipWhitespace(parser);
		if (peek(parser) === ")") {
			consume(parser, ")");
			break;
		}
		args.push(parseExpressionInternal(parser));
		skipWhitespace(parser);
		if (peek(parser) === ",") {
			consume(parser, ",");
			continue;
		}
		consume(parser, ")");
		break;
	}
	return { kind: "Call", fn, args };
}

function parseStepRef(parser: ParserState): ExprAst {
	const root = parseIdentifier(parser);
	if (root !== "steps") {
		throw new Error(`Unsupported root identifier "${root}"`);
	}
	consume(parser, ".");
	const stepId = parseReferenceSegment(parser);
	consume(parser, ".");
	const port = parseIdentifier(parser);
	return {
		kind: "StepRef",
		stepId,
		port,
		path: parsePath(parser),
	};
}

function parseIdentifierExpression(parser: ParserState): ExprAst {
	const start = parser.index;
	const identifier = parseIdentifier(parser);
	skipWhitespace(parser);
	if (peek(parser) === "(") {
		return parseCall(parser, identifier);
	}
	parser.index = start;
	return parseStepRef(parser);
}

function parseExpressionInternal(parser: ParserState): ExprAst {
	skipWhitespace(parser);
	const literal = parseLiteral(parser);
	if (literal) return literal;
	if (isIdentifierStart(peek(parser))) {
		return parseIdentifierExpression(parser);
	}
	throw new Error(`Unexpected token at position ${parser.index}`);
}

export function parseExpression(source: string): ExprAst {
	const parser = createParser(source.trim());
	const ast = parseExpressionInternal(parser);
	skipWhitespace(parser);
	if (parser.index !== parser.source.length) {
		throw new Error(`Unexpected token at position ${parser.index}`);
	}
	return ast;
}

export function parseTemplate(source: string): TemplateAst {
	const ast: TemplateAst = [];
	let cursor = 0;
	while (cursor < source.length) {
		const open = source.indexOf("{{", cursor);
		if (open === -1) {
			ast.push({ kind: "Text", value: source.slice(cursor) });
			break;
		}
		if (open > cursor) {
			ast.push({ kind: "Text", value: source.slice(cursor, open) });
		}
		const close = source.indexOf("}}", open + 2);
		if (close === -1) {
			throw new Error("Unclosed expression block");
		}
		const exprSource = source.slice(open + 2, close).trim();
		ast.push({ kind: "Expr", expr: parseExpression(exprSource) });
		cursor = close + 2;
	}
	return ast;
}

function walkPath(value: unknown, path: PathSegment[]): unknown {
	let current = value;
	for (const segment of path) {
		if (current === null || current === undefined) return undefined;
		if (typeof segment === "number") {
			if (!Array.isArray(current)) return undefined;
			current = current[segment];
			continue;
		}
		if (typeof current !== "object") return undefined;
		current = (current as Record<string, unknown>)[segment];
	}
	return current;
}

function evaluateExpressionAst(
	ast: ExprAst,
	outputs: Record<string, NodeOutput>,
): unknown {
	switch (ast.kind) {
		case "Literal":
			return ast.value;
		case "StepRef": {
			const output = outputs[ast.stepId];
			if (!output) return undefined;
			if (ast.port !== "output") return undefined;
			return ast.path.length === 0
				? output.data
				: walkPath(output.data, ast.path);
		}
		case "Call": {
			const args = ast.args.map((arg) => evaluateExpressionAst(arg, outputs));
			switch (ast.fn) {
				case "coalesce":
					return args.find((arg) => arg !== null && arg !== undefined);
				default:
					throw new Error(`Unsupported expression helper "${ast.fn}"`);
			}
		}
	}
}

function evaluateTemplateAst(
	ast: TemplateAst,
	outputs: Record<string, NodeOutput>,
): unknown {
	if (ast.length === 1 && ast[0]?.kind === "Expr") {
		return evaluateExpressionAst(ast[0].expr, outputs);
	}
	return ast
		.map((part) =>
			part.kind === "Text"
				? part.value
				: String(evaluateExpressionAst(part.expr, outputs) ?? ""),
		)
		.join("");
}

function tryParseTemplate(source: string): TemplateAst | null {
	if (!source.includes("{{")) return null;
	try {
		return parseTemplate(source);
	} catch {
		return null;
	}
}

function collectStepRefsFromExpr(ast: ExprAst, refs: StepReference[]): void {
	switch (ast.kind) {
		case "Literal":
			return;
		case "StepRef":
			refs.push({ stepId: ast.stepId, port: ast.port, path: ast.path });
			return;
		case "Call":
			for (const arg of ast.args) collectStepRefsFromExpr(arg, refs);
			return;
	}
}

export function collectStepReferences(
	ast: ExprAst | TemplateAst,
): StepReference[] {
	const refs: StepReference[] = [];
	if (Array.isArray(ast)) {
		for (const part of ast) {
			if (part.kind === "Expr") collectStepRefsFromExpr(part.expr, refs);
		}
		return refs;
	}
	collectStepRefsFromExpr(ast, refs);
	return refs;
}

export function resolveExpressions(
	config: Record<string, unknown>,
	previousOutputs: Record<string, NodeOutput>,
): Record<string, unknown> {
	return resolveValue(config, previousOutputs) as Record<string, unknown>;
}

function resolveValue(
	value: unknown,
	outputs: Record<string, NodeOutput>,
): unknown {
	if (typeof value === "string") {
		const template = tryParseTemplate(value);
		return template ? evaluateTemplateAst(template, outputs) : value;
	}
	if (Array.isArray(value)) {
		return value.map((item) => resolveValue(item, outputs));
	}
	if (value !== null && typeof value === "object") {
		const result: Record<string, unknown> = {};
		for (const [key, nested] of Object.entries(
			value as Record<string, unknown>,
		)) {
			result[key] = resolveValue(nested, outputs);
		}
		return result;
	}
	return value;
}

export function findUnresolvedRefs(
	config: Record<string, unknown>,
	previousOutputs: Record<string, NodeOutput>,
): string[] {
	const unresolved: string[] = [];
	const seen = new Set<string>();

	function scan(value: unknown): void {
		if (typeof value === "string") {
			const template = tryParseTemplate(value);
			if (!template) return;
			for (const ref of collectStepReferences(template)) {
				const key =
					ref.path.length > 0
						? `steps.${ref.stepId}.${ref.port}.${ref.path.join(".")}`
						: `steps.${ref.stepId}.${ref.port}`;
				if (!seen.has(key) && !(ref.stepId in previousOutputs)) {
					seen.add(key);
					unresolved.push(key);
				}
			}
			return;
		}
		if (Array.isArray(value)) {
			for (const item of value) scan(item);
			return;
		}
		if (value !== null && typeof value === "object") {
			for (const nested of Object.values(value as Record<string, unknown>)) {
				scan(nested);
			}
		}
	}

	scan(config);
	return unresolved;
}
