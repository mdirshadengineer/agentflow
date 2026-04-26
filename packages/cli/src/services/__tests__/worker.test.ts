import { describe, expect, it } from "vitest";
import type { WorkflowStep } from "../worker.js";
import { executeStep } from "../worker.js";

describe("executeStep()", () => {
	it('returns a completion message for a "noop" step', async () => {
		const step: WorkflowStep = { name: "build", type: "noop" };
		const result = await executeStep(step);
		expect(result).toBe('Step "build" (noop) completed.');
	});

	it("returns a generic message for an unknown step type", async () => {
		const step: WorkflowStep = {
			name: "deploy",
			type: "custom-type",
			config: { env: "production" },
		};
		const result = await executeStep(step);
		expect(result).toContain("deploy");
		expect(result).toContain("custom-type");
		expect(result).toContain('"env":"production"');
	});

	it("handles a step with no config for an unknown type", async () => {
		const step: WorkflowStep = { name: "notify", type: "email" };
		const result = await executeStep(step);
		expect(result).toContain("notify");
		expect(result).toContain("email");
		expect(result).toContain("{}");
	});

	it("includes step name in the noop message", async () => {
		const step: WorkflowStep = { name: "my-special-step", type: "noop" };
		const result = await executeStep(step);
		expect(result).toBe('Step "my-special-step" (noop) completed.');
	});
});
