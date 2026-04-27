import type { ToolDefinition } from "./tool-registry.js";
import type {
	ChatMessage,
	LLMOptions,
	LLMResponse,
	LLMToolResponse,
	ToolCall,
} from "./types.js";

/** A provider-agnostic interface for calling LLM chat APIs. */
export interface LLMProvider {
	/**
	 * Send a chat request and receive a text response.
	 */
	chat(messages: ChatMessage[], options?: LLMOptions): Promise<LLMResponse>;

	/**
	 * Send a chat request with available tools. The model may request tool
	 * invocations; the caller is responsible for executing them and looping.
	 */
	chatWithTools(
		messages: ChatMessage[],
		tools: ToolDefinition[],
		options?: LLMOptions,
	): Promise<LLMToolResponse>;
}

// ── Internal response shapes ──────────────────────────────────────────────────

interface OpenAIChoice {
	finish_reason: string;
	message: {
		role: string;
		content: string | null;
		tool_calls?: Array<{
			id: string;
			type: string;
			function: { name: string; arguments: string };
		}>;
	};
}

interface OpenAIChatCompletionResponse {
	model: string;
	choices: OpenAIChoice[];
}

type AnthropicContentBlock =
	| { type: "text"; text: string }
	| {
			type: "tool_use";
			id: string;
			name: string;
			input: Record<string, unknown>;
	  };

interface AnthropicMessagesResponse {
	model: string;
	stop_reason: string;
	content: AnthropicContentBlock[];
}

// ── OpenAI provider ───────────────────────────────────────────────────────────

export interface OpenAIConfig {
	/** OpenAI API key. Falls back to the OPENAI_API_KEY environment variable. */
	apiKey?: string;
	/** Base URL override — for OpenAI-compatible endpoints (Ollama, LM Studio…). */
	baseUrl?: string;
}

/**
 * LLMProvider implementation for the OpenAI Chat Completions API.
 * Also works with any OpenAI-compatible endpoint.
 */
export class OpenAIProvider implements LLMProvider {
	private readonly apiKey: string;
	private readonly baseUrl: string;

	constructor(config: OpenAIConfig = {}) {
		const key = config.apiKey ?? process.env.OPENAI_API_KEY;
		if (!key) {
			throw new Error(
				"OpenAIProvider: API key is required. Set OPENAI_API_KEY or pass apiKey in config.",
			);
		}
		this.apiKey = key;
		this.baseUrl = config.baseUrl ?? "https://api.openai.com/v1";
	}

	async chat(
		messages: ChatMessage[],
		options?: LLMOptions,
	): Promise<LLMResponse> {
		const response = await fetch(`${this.baseUrl}/chat/completions`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.apiKey}`,
			},
			body: JSON.stringify({
				model: options?.model ?? "gpt-4o-mini",
				messages: messages.map(toOpenAIMessage),
				temperature: options?.temperature,
				max_tokens: options?.maxTokens,
			}),
		});

		if (!response.ok) {
			const body = await response.text();
			throw new Error(`OpenAI API error ${response.status}: ${body}`);
		}

		const data = (await response.json()) as OpenAIChatCompletionResponse;
		const choice = data.choices[0];
		if (!choice) {
			throw new Error("OpenAI API returned no choices");
		}

		return {
			content: choice.message.content ?? "",
			model: data.model,
			finishReason: choice.finish_reason,
		};
	}

	async chatWithTools(
		messages: ChatMessage[],
		tools: ToolDefinition[],
		options?: LLMOptions,
	): Promise<LLMToolResponse> {
		const response = await fetch(`${this.baseUrl}/chat/completions`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.apiKey}`,
			},
			body: JSON.stringify({
				model: options?.model ?? "gpt-4o-mini",
				messages: messages.map(toOpenAIMessage),
				tools: tools.map(toOpenAITool),
				tool_choice: "auto",
				temperature: options?.temperature,
				max_tokens: options?.maxTokens,
			}),
		});

		if (!response.ok) {
			const body = await response.text();
			throw new Error(`OpenAI API error ${response.status}: ${body}`);
		}

		const data = (await response.json()) as OpenAIChatCompletionResponse;
		const choice = data.choices[0];
		if (!choice) {
			throw new Error("OpenAI API returned no choices");
		}

		const toolCalls: ToolCall[] = (choice.message.tool_calls ?? []).map(
			(tc) => ({
				id: tc.id,
				name: tc.function.name,
				arguments: JSON.parse(tc.function.arguments) as Record<string, unknown>,
			}),
		);

		return {
			content: choice.message.content,
			toolCalls,
			model: data.model,
			finishReason: choice.finish_reason,
		};
	}
}

// ── Anthropic provider ────────────────────────────────────────────────────────

export interface AnthropicConfig {
	/** Anthropic API key. Falls back to the ANTHROPIC_API_KEY environment variable. */
	apiKey?: string;
	/** Base URL override. */
	baseUrl?: string;
}

/**
 * LLMProvider implementation for the Anthropic Messages API.
 */
export class AnthropicProvider implements LLMProvider {
	private readonly apiKey: string;
	private readonly baseUrl: string;

	constructor(config: AnthropicConfig = {}) {
		const key = config.apiKey ?? process.env.ANTHROPIC_API_KEY;
		if (!key) {
			throw new Error(
				"AnthropicProvider: API key is required. Set ANTHROPIC_API_KEY or pass apiKey in config.",
			);
		}
		this.apiKey = key;
		this.baseUrl = config.baseUrl ?? "https://api.anthropic.com";
	}

	async chat(
		messages: ChatMessage[],
		options?: LLMOptions,
	): Promise<LLMResponse> {
		const { system, anthropicMessages } = splitSystemMessage(messages);

		const response = await fetch(`${this.baseUrl}/v1/messages`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": this.apiKey,
				"anthropic-version": "2023-06-01",
			},
			body: JSON.stringify({
				model: options?.model ?? "claude-3-haiku-20240307",
				max_tokens: options?.maxTokens ?? 1024,
				temperature: options?.temperature,
				system,
				messages: anthropicMessages,
			}),
		});

		if (!response.ok) {
			const body = await response.text();
			throw new Error(`Anthropic API error ${response.status}: ${body}`);
		}

		const data = (await response.json()) as AnthropicMessagesResponse;
		const textBlock = data.content.find((b) => b.type === "text");
		const content = textBlock?.type === "text" ? textBlock.text : "";

		return { content, model: data.model, finishReason: data.stop_reason };
	}

	async chatWithTools(
		messages: ChatMessage[],
		tools: ToolDefinition[],
		options?: LLMOptions,
	): Promise<LLMToolResponse> {
		const { system, anthropicMessages } = splitSystemMessage(messages);

		const response = await fetch(`${this.baseUrl}/v1/messages`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": this.apiKey,
				"anthropic-version": "2023-06-01",
			},
			body: JSON.stringify({
				model: options?.model ?? "claude-3-haiku-20240307",
				max_tokens: options?.maxTokens ?? 1024,
				temperature: options?.temperature,
				system,
				messages: anthropicMessages,
				tools: tools.map(toAnthropicTool),
			}),
		});

		if (!response.ok) {
			const body = await response.text();
			throw new Error(`Anthropic API error ${response.status}: ${body}`);
		}

		const data = (await response.json()) as AnthropicMessagesResponse;
		const textBlock = data.content.find((b) => b.type === "text");
		const content = textBlock?.type === "text" ? textBlock.text : null;

		const toolCalls: ToolCall[] = data.content
			.filter(
				(b): b is Extract<AnthropicContentBlock, { type: "tool_use" }> =>
					b.type === "tool_use",
			)
			.map((b) => ({ id: b.id, name: b.name, arguments: b.input }));

		return {
			content,
			toolCalls,
			model: data.model,
			finishReason: data.stop_reason,
		};
	}
}

// ── Private helpers ───────────────────────────────────────────────────────────

function toOpenAIMessage(msg: ChatMessage): Record<string, unknown> {
	if (msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0) {
		return {
			role: "assistant",
			content: msg.content || null,
			tool_calls: msg.toolCalls.map((tc) => ({
				id: tc.id,
				type: "function",
				function: {
					name: tc.name,
					arguments: JSON.stringify(tc.arguments),
				},
			})),
		};
	}
	if (msg.role === "tool") {
		return {
			role: "tool",
			content: msg.content,
			tool_call_id: msg.toolCallId ?? "",
		};
	}
	return { role: msg.role, content: msg.content };
}

function toOpenAITool(tool: ToolDefinition): Record<string, unknown> {
	return {
		type: "function",
		function: {
			name: tool.name,
			description: tool.description,
			parameters: tool.inputSchema,
		},
	};
}

function splitSystemMessage(messages: ChatMessage[]): {
	system: string | undefined;
	anthropicMessages: Array<{ role: string; content: string }>;
} {
	const system = messages.find((m) => m.role === "system")?.content;
	const anthropicMessages = messages
		.filter((m) => m.role !== "system")
		.map((m) => ({ role: m.role, content: m.content }));
	return { system, anthropicMessages };
}

function toAnthropicTool(tool: ToolDefinition): Record<string, unknown> {
	return {
		name: tool.name,
		description: tool.description,
		input_schema: tool.inputSchema,
	};
}
