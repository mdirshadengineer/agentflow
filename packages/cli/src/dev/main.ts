import { createAPIServer } from "../server/api-server.js";

async function main() {
	const apiServer = createAPIServer();
	await apiServer.start();
}

main().catch((err) => {
	console.error("Error starting development environment:", err);
	process.exit(1);
});
