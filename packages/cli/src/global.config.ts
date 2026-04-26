import { homedir } from "node:os";
import { join } from "node:path";

// Global configuration for the agentflow application.
export const AGENTFLOW_DATA_DIR =
	process.env.AGENTFLOW_DATA_DIR ?? join(homedir(), ".agentflow");

export const AGENTFLOW_DEFAULT_COMMAND = "start";

export const AGENTFLOW_API_SERVER_PORT = Number(
	process.env.AGENTFLOW_PORT ?? "3000",
);

const _jwtEnv = process.env.AGENTFLOW_JWT_SECRET;
if (!_jwtEnv && process.env.NODE_ENV === "production") {
	throw new Error("AGENTFLOW_JWT_SECRET must be set in production");
}
export const AGENTFLOW_JWT_SECRET =
	_jwtEnv ?? "agentflow-dev-secret-change-in-production";

export const POLL_INTERVAL_MS: number = 200; // 200ms

export const GRACEFUL_SHUTDOWN_TIMEOUT_MS: number = 5000; // 5 seconds
