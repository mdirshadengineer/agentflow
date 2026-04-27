import type { NodeExecutor } from "@mdirshadengineer/agentflow-core";

/**
 * HTTP Request executor.
 *
 * Config fields (from {@link WorkflowStep.config}):
 * - `url`     {string}  — required — the URL to request
 * - `method`  {string}  — optional — HTTP method (default: "GET")
 * - `headers` {object}  — optional — key/value string headers
 * - `body`    {string}  — optional — raw request body
 */
export const httpRequestExecutor: NodeExecutor = async (input, context) => {
	const { url, method, headers, body } = input.data;

	if (typeof url !== "string" || url.trim() === "") {
		return {
			data: {},
			status: "failed",
			logs: `http-request: "url" config field is required (runId: ${context.runId})`,
		};
	}

	const resolvedMethod =
		typeof method === "string" ? method.toUpperCase() : "GET";

	const resolvedHeaders: Record<string, string> = {};
	if (
		headers !== null &&
		typeof headers === "object" &&
		!Array.isArray(headers)
	) {
		for (const [k, v] of Object.entries(headers)) {
			if (typeof v === "string") {
				resolvedHeaders[k] = v;
			}
		}
	}

	const resolvedBody =
		typeof body === "string" && body.length > 0 ? body : undefined;

	let responseStatus: number;
	let responseBody: string;

	try {
		const init: RequestInit = {
			method: resolvedMethod,
			headers: resolvedHeaders,
		};
		if (resolvedBody !== undefined) {
			init.body = resolvedBody;
		}
		const response = await fetch(url, init);
		responseStatus = response.status;
		responseBody = await response.text();
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			data: {},
			status: "failed",
			logs: `http-request: fetch failed — ${message} (runId: ${context.runId})`,
		};
	}

	const succeeded = responseStatus >= 200 && responseStatus < 300;
	return {
		data: { status: responseStatus, body: responseBody },
		status: succeeded ? "success" : "failed",
		logs: `http-request: ${resolvedMethod} ${url} → ${responseStatus} (runId: ${context.runId})`,
	};
};
