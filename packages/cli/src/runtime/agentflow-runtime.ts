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
					// Preserve the original error as `cause` so callers retain the full
					// stack trace and any structured properties on the underlying error.
					throw new Error(
						`Failed to start service at index ${index}: ${error instanceof Error ? error.message : String(error)}`,
						{ cause: error },
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
						// Preserve the original stop error as `cause` for the same reason.
						cleanupError =
							stopError instanceof Error
								? stopError
								: new Error(String(stopError), { cause: stopError });
					}
				}
			}

			const startError =
				error instanceof Error
					? error
					: new Error(String(error), { cause: error });

			if (cleanupError) {
				// Surface both the startup failure and the cleanup failure.
				// The startup error is attached as `cause` so its original chain
				// (including its own `cause`) is fully reachable.
				throw new Error(
					`${startError.message}. Cleanup failed: ${cleanupError.message}`,
					{ cause: startError },
				);
			}

			throw startError;
		}
	}

	async stop() {
		const stopErrors: Error[] = [];
		for (const [index, service] of this.services.slice().reverse().entries()) {
			try {
				await service.stop();
			} catch (error) {
				stopErrors.push(
					error instanceof Error
						? new Error(
								`Failed to stop service at reverse index ${index}: ${error.message}`,
								{ cause: error },
							)
						: new Error(
								`Failed to stop service at reverse index ${index}: ${String(error)}`,
								{ cause: error },
							),
				);
			}
		}
		if (stopErrors.length > 0) {
			throw new AggregateError(
				stopErrors,
				"Failed to stop one or more services.",
			);
		}
	}
}

export { AgentflowRuntime };
