export type ProcessRecord = {
	id: string;
	pid: number;
	command: string;
	args: string[];
	startedAt: number; // epoch ms
};
