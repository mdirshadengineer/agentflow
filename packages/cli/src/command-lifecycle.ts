interface CommandLifecycleHooks {
	// Define lifecycle hooks for commands here, e.g.:
	onInit?(): Promise<void> | void;
	onBeforeExecute?(): Promise<void> | void;
	onAfterExecute?(): Promise<void> | void;
	onError?(error: Error): Promise<void> | void;
	onFinally?(): Promise<void> | void;
}

abstract class CommandLifecycle<
	Flags extends Record<string, unknown> = Record<string, unknown>,
> implements CommandLifecycleHooks
{
	flags!: Flags;
	args!: readonly string[];

	onInit?(): Promise<void> | void;
	onBeforeExecute?(): Promise<void> | void;
	onAfterExecute?(): Promise<void> | void;
	onError?(error: Error): Promise<void> | void;
	onFinally?(): Promise<void> | void;

	protected abstract run(): Promise<void>;

	async execute(): Promise<void> {
		try {
			await this.onInit?.();
			await this.onBeforeExecute?.();
			await this.run();
			await this.onAfterExecute?.();
		} catch (error) {
			if (error instanceof Error) {
				await this.onError?.(error);
			}
			throw error;
		} finally {
			await this.onFinally?.();
		}
	}
}

export { CommandLifecycle, type CommandLifecycleHooks };
