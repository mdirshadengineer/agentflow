import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
	id: text("id").primaryKey(),
	email: text("email").notNull().unique(),
	passwordHash: text("password_hash").notNull(),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch('now') * 1000)`),
});

export const agents = sqliteTable("agents", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	description: text("description"),
	type: text("type").notNull(),
	config: text("config").notNull().default("{}"),
	llmProvider: text("llm_provider"),
	llmModel: text("llm_model"),
	systemPrompt: text("system_prompt"),
	tools: text("tools"),
	ownerId: text("owner_id").notNull(),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch('now') * 1000)`),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch('now') * 1000)`),
});

export const workflows = sqliteTable("workflows", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	definition: text("definition").notNull().default("{}"),
	ownerId: text("owner_id").notNull(),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch('now') * 1000)`),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch('now') * 1000)`),
});

export const workflowRuns = sqliteTable("workflow_runs", {
	id: text("id").primaryKey(),
	workflowId: text("workflow_id").notNull(),
	status: text("status", {
		enum: ["queued", "running", "success", "failed"],
	})
		.notNull()
		.default("queued"),
	startedAt: integer("started_at", { mode: "timestamp_ms" }),
	finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
	output: text("output"),
});

export const workflowRunSteps = sqliteTable("workflow_run_steps", {
	id: text("id").primaryKey(),
	runId: text("run_id").notNull(),
	stepName: text("step_name").notNull(),
	status: text("status").notNull(),
	logs: text("logs"),
	startedAt: integer("started_at", { mode: "timestamp_ms" }),
	finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
});

export const nodeExecutions = sqliteTable("node_executions", {
	id: text("id").primaryKey(),
	runId: text("run_id").notNull(),
	nodeId: text("node_id").notNull(),
	stepName: text("step_name").notNull(),
	nodeType: text("node_type").notNull(),
	status: text("status").notNull(),
	inputData: text("input_data"),
	outputData: text("output_data"),
	logs: text("logs"),
	startedAt: integer("started_at", { mode: "timestamp_ms" }),
	finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
});

export const agentSessions = sqliteTable("agent_sessions", {
	id: text("id").primaryKey(),
	agentId: text("agent_id").notNull(),
	workflowRunId: text("workflow_run_id"),
	messages: text("messages").notNull().default("[]"),
	status: text("status").notNull(),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch('now') * 1000)`),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch('now') * 1000)`),
});
