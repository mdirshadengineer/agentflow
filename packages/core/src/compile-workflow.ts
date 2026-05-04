import { buildDag, type CanvasNode } from "./build-dag.js";
import { collectStepReferences, parseTemplate } from "./expression-resolver.js";
import type {
	ConfigValue,
	CredentialRef,
	ExecutionPlan,
	JsonSchema,
	NodeCatalogEntry,
	PathSegment,
	SymbolTable,
	WorkflowCompileError,
	WorkflowCompileResult,
	WorkflowStep,
} from "./types.js";

export interface CompileWorkflowOptions {
	nodeCatalog?: Iterable<NodeCatalogEntry>;
}

function pathSegmentsToString(path: PathSegment[]): string {
	return path
		.map((segment) =>
			typeof segment === "number" ? `[${segment}]` : `${segment}`,
		)
		.join(".")
		.replace(/\.\[/g, "[");
}

function buildNodeCatalogMap(
	nodeCatalog?: Iterable<NodeCatalogEntry>,
): Map<string, NodeCatalogEntry> {
	return new Map(
		Array.from(nodeCatalog ?? []).map((entry) => [entry.type, entry]),
	);
}

function buildCompiledValue(value: unknown): ConfigValue {
	if (typeof value !== "string" || !value.includes("{{")) {
		return { kind: "literal", value };
	}
	const ast = parseTemplate(value);
	if (ast.length === 1 && ast[0]?.kind === "Expr") {
		return { kind: "expression", source: value, ast: ast[0].expr };
	}
	return { kind: "template", source: value, ast };
}

function collectConfigErrors(
	step: WorkflowStep,
	compiled: ConfigValue,
	knownSteps: Set<string>,
	upstreamSteps: Set<string>,
	errors: WorkflowCompileError[],
	field: string,
): void {
	if (compiled.kind === "literal") return;
	for (const ref of collectStepReferences(compiled.ast)) {
		const reference =
			ref.path.length > 0
				? `steps.${ref.stepId}.${ref.port}.${pathSegmentsToString(ref.path)}`
				: `steps.${ref.stepId}.${ref.port}`;
		if (!knownSteps.has(ref.stepId)) {
			errors.push({
				code: "unknown_step_reference",
				message: `Step "${step.name}" references unknown step "${ref.stepId}" in field "${field}".`,
				stepName: step.name,
				field,
				reference,
			});
			continue;
		}
		if (!upstreamSteps.has(ref.stepId)) {
			errors.push({
				code: "non_upstream_reference",
				message: `Step "${step.name}" references non-upstream step "${ref.stepId}" in field "${field}".`,
				stepName: step.name,
				field,
				reference,
			});
		}
	}
}

function computeTopologicalLevels(
	steps: WorkflowStep[],
	errors: WorkflowCompileError[],
): string[][] {
	const dependents = new Map<string, string[]>();
	const indegree = new Map<string, number>();
	for (const step of steps) {
		indegree.set(step.name, step.dependsOn?.length ?? 0);
		dependents.set(step.name, []);
	}
	for (const step of steps) {
		for (const dependency of step.dependsOn ?? []) {
			const list = dependents.get(dependency);
			if (list) list.push(step.name);
		}
	}

	let frontier = steps
		.filter((step) => (indegree.get(step.name) ?? 0) === 0)
		.map((step) => step.name);
	const levels: string[][] = [];
	let visited = 0;

	while (frontier.length > 0) {
		levels.push(frontier);
		visited += frontier.length;
		const next: string[] = [];
		for (const name of frontier) {
			for (const dependent of dependents.get(name) ?? []) {
				const nextDegree = (indegree.get(dependent) ?? 0) - 1;
				indegree.set(dependent, nextDegree);
				if (nextDegree === 0) next.push(dependent);
			}
		}
		frontier = next;
	}

	if (visited !== steps.length) {
		const cyclicSteps = steps
			.map((step) => step.name)
			.filter((name) => (indegree.get(name) ?? 0) > 0);
		errors.push({
			code: "cycle",
			message: `Workflow contains a dependency cycle involving: ${cyclicSteps.join(", ")}`,
		});
	}

	return levels;
}

function collectUpstreamSteps(
	stepName: string,
	dependencies: Record<string, string[]>,
): Set<string> {
	const visited = new Set<string>();
	const stack = [...(dependencies[stepName] ?? [])];
	while (stack.length > 0) {
		const current = stack.pop();
		if (!current || visited.has(current)) continue;
		visited.add(current);
		stack.push(...(dependencies[current] ?? []));
	}
	return visited;
}

function buildSymbolTable(
	steps: WorkflowStep[],
	canvasNodeById: Map<string, CanvasNode>,
	nodeCatalog: Map<string, NodeCatalogEntry>,
): SymbolTable {
	const symbolTable: SymbolTable = { steps: {} };
	for (const step of steps) {
		const canvasNode = canvasNodeById.get(step.name);
		const entry = nodeCatalog.get(step.type);
		const labelValue = canvasNode?.data.label;
		symbolTable.steps[step.name] = {
			stepId: step.name,
			label:
				typeof labelValue === "string" && labelValue.length > 0
					? labelValue
					: step.name,
			outputs:
				entry?.outputs.reduce<Record<string, JsonSchema>>((acc, output) => {
					if (output.type.schema) acc[output.name] = output.type.schema;
					return acc;
				}, {}) ?? {},
		};
	}
	return symbolTable;
}

function buildCredentialRefs(
	step: WorkflowStep,
	catalogEntry: NodeCatalogEntry | undefined,
): Record<string, CredentialRef> {
	if (!catalogEntry?.credentials || !step.config) return {};
	const refs: Record<string, CredentialRef> = {};
	for (const credential of catalogEntry.credentials) {
		const credentialId = step.config[credential.name];
		if (typeof credentialId === "string" && credentialId.length > 0) {
			refs[credential.name] = {
				credentialId,
				expectedType: credential.credentialType,
			};
		}
	}
	return refs;
}

function validateRequiredFields(
	step: WorkflowStep,
	catalogEntry: NodeCatalogEntry | undefined,
	errors: WorkflowCompileError[],
): void {
	for (const field of catalogEntry?.configSchema.fields ?? []) {
		if (!field.required) continue;
		const value = step.config?.[field.key];
		if (value === undefined || value === null || value === "") {
			errors.push({
				code: "missing_required_field",
				message: `Step "${step.name}" is missing required field "${field.key}".`,
				stepName: step.name,
				field: field.key,
			});
		}
	}
}

export function compileWorkflow(
	raw: unknown,
	options: CompileWorkflowOptions = {},
): WorkflowCompileResult {
	const definition = buildDag(raw);
	const steps = definition.steps ?? [];
	const nodeCatalog = buildNodeCatalogMap(options.nodeCatalog);
	const canvasNodes = Array.isArray((raw as { nodes?: unknown })?.nodes)
		? ((raw as { nodes: CanvasNode[] }).nodes ?? [])
		: [];
	const canvasNodeById = new Map(canvasNodes.map((node) => [node.id, node]));
	const knownSteps = new Set(steps.map((step) => step.name));
	const dependencies = Object.fromEntries(
		steps.map((step) => [step.name, step.dependsOn ?? []]),
	) as Record<string, string[]>;
	const errors: WorkflowCompileError[] = [];
	const compiledConfig: Record<string, Record<string, ConfigValue>> = {};
	const credentialRefs: Record<string, Record<string, CredentialRef>> = {};
	const schemas: Record<string, { output?: JsonSchema }> = {};

	for (const step of steps) {
		const upstreamSteps = collectUpstreamSteps(step.name, dependencies);
		compiledConfig[step.name] = {};
		const catalogEntry = nodeCatalog.get(step.type);
		validateRequiredFields(step, catalogEntry, errors);
		credentialRefs[step.name] = buildCredentialRefs(step, catalogEntry);
		schemas[step.name] = catalogEntry?.outputJsonSchema
			? { output: catalogEntry.outputJsonSchema }
			: {};
		for (const [field, value] of Object.entries(step.config ?? {})) {
			try {
				const compiled = buildCompiledValue(value);
				const stepCompiledConfig = compiledConfig[step.name];
				if (!stepCompiledConfig) continue;
				stepCompiledConfig[field] = compiled;
				collectConfigErrors(
					step,
					compiled,
					knownSteps,
					upstreamSteps,
					errors,
					field,
				);
			} catch (error) {
				errors.push({
					code: "invalid_expression",
					message:
						error instanceof Error
							? `Invalid expression in step "${step.name}" field "${field}": ${error.message}`
							: `Invalid expression in step "${step.name}" field "${field}".`,
					stepName: step.name,
					field,
				});
			}
		}
	}

	const plan: ExecutionPlan = {
		steps,
		dependencies,
		topologicalLevels: computeTopologicalLevels(steps, errors),
		schemas,
		credentialRefs,
		symbolTable: buildSymbolTable(steps, canvasNodeById, nodeCatalog),
		compiledConfig,
	};

	return { definition, plan, errors };
}
