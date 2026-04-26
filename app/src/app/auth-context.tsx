import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react"

interface User {
	id: string
	email: string
}

interface AuthContextValue {
	user: User | null
	loading: boolean
	login: (email: string, password: string) => Promise<void>
	register: (email: string, password: string) => Promise<void>
	logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function AuthProvider({ children }: { children: React.ReactNode }) {
	const [user, setUser] = useState<User | null>(null)
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		fetch("/api/v1/auth/me")
			.then((r) => (r.ok ? (r.json() as Promise<User>) : null))
			.then((u) => setUser(u))
			.catch(() => setUser(null))
			.finally(() => setLoading(false))
	}, [])

	const login = useCallback(async (email: string, password: string) => {
		const r = await fetch("/api/v1/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, password }),
		})
		if (!r.ok) {
			const err = (await r.json()) as { error: string }
			throw new Error(err.error)
		}
		const u = (await r.json()) as User
		setUser(u)
	}, [])

	const register = useCallback(async (email: string, password: string) => {
		const r = await fetch("/api/v1/auth/register", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, password }),
		})
		if (!r.ok) {
			const err = (await r.json()) as { error: string }
			throw new Error(err.error)
		}
		const u = (await r.json()) as User
		setUser(u)
	}, [])

	const logout = useCallback(async () => {
		await fetch("/api/v1/auth/logout", { method: "POST" })
		setUser(null)
	}, [])

	return (
		<AuthContext.Provider value={{ user, loading, login, register, logout }}>
			{children}
		</AuthContext.Provider>
	)
}

function useAuth() {
	const ctx = useContext(AuthContext)
	if (!ctx) throw new Error("useAuth must be used within AuthProvider")
	return ctx
}

export { AuthProvider, useAuth }
