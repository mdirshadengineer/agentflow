import { createAPIServer } from "../server/api-server.js";
import { createScheduler } from "../services/scheduler.js";
import { createWorker } from "../services/worker.js";
import { AgentflowRuntime } from "./agentflow-runtime.js";

const runtime = new AgentflowRuntime();

runtime.register(createAPIServer());
runtime.register(createScheduler());
runtime.register(createWorker());

export { runtime };
