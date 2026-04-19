import { injectable } from "tsyringe";

@injectable()
class AgentflowRuntime {
	private services: Array<{ start(): Promise<void>; stop(): Promise<void> }> =
		[];

	register(service: { start(): Promise<void>; stop(): Promise<void> }) {
		this.services.push(service);
	}

	async start() {
		const startedServices: Array<{
			start(): Promise<void>;
			stop(): Promise<void>;
		}> = [];

		try {
			for (const [index, service] of this.services.entries()) {
				try {
					await service.start();
					startedServices.push(service);
				} catch (error) {
					const message =
						error instanceof Error ? error.message : String(error);
					throw new Error(
						`Failed to start service at index ${index}: ${message}`,
					);
				}
			}
		} catch (error) {
			let cleanupError: Error | undefined;

			for (const service of startedServices.slice().reverse()) {
				try {
					await service.stop();
				} catch (stopError) {
					if (!cleanupError) {
						cleanupError =
							stopError instanceof Error
								? stopError
								: new Error(String(stopError));
					}
				}
			}

			const startError =
				error instanceof Error ? error : new Error(String(error));

			if (cleanupError) {
				throw new Error(
					`${startError.message}. Cleanup failed: ${cleanupError.message}`,
				);
			}

			throw startError;
		}
	}

	async stop() {
		for (const service of this.services.slice().reverse()) {
			await service.stop();
		}
	}
}

export { AgentflowRuntime };
