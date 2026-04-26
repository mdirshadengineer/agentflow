import { useEffect, useRef, useState } from "react"

export interface RunStep {
	id: string
	runId: string
	stepName: string
	status: string
	logs: string | null
	startedAt: number | null
	finishedAt: number | null
}

export interface RunData {
	id: string
	workflowId: string
	status: "queued" | "running" | "success" | "failed"
	startedAt: number | null
	finishedAt: number | null
	output: unknown
}

export interface RunSnapshot {
	run: RunData
	steps: RunStep[]
}

export type StreamStatus =
	| "connecting"
	| "connected"
	| "done"
	| "error"
	| "closed"

export function useRunStream(runId: string) {
	const [snapshot, setSnapshot] = useState<RunSnapshot | null>(null)
	const [streamStatus, setStreamStatus] = useState<StreamStatus>("connecting")
	const esRef = useRef<EventSource | null>(null)

	useEffect(() => {
		const es = new EventSource(`/api/v1/runs/${runId}/stream`)
		esRef.current = es

		es.addEventListener("snapshot", (e: MessageEvent<string>) => {
			const data = JSON.parse(e.data) as RunSnapshot
			setSnapshot(data)
			setStreamStatus("connected")
		})

		es.addEventListener("update", (e: MessageEvent<string>) => {
			const data = JSON.parse(e.data) as RunSnapshot
			setSnapshot(data)
		})

		es.addEventListener("done", () => {
			setStreamStatus("done")
			es.close()
		})

		es.onerror = () => {
			setStreamStatus("error")
			es.close()
		}

		return () => {
			es.close()
			esRef.current = null
			setStreamStatus("closed")
		}
	}, [runId])

	return { snapshot, streamStatus }
}
