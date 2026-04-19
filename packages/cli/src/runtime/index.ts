import { createAPIServer } from "../server/api-server.js";
import { AgentflowRuntime } from "./agentflow-runtime.js";

const runtime = new AgentflowRuntime();

runtime.register(createAPIServer());

// future:
// runtime.register(createScheduler());
// runtime.register(createWorker());

export { runtime };
