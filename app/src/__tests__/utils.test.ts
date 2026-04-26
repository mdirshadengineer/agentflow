import { describe, expect, it } from "vitest"
import { cn } from "../lib/utils.js"

describe("cn()", () => {
	it("returns a single class name unchanged", () => {
		expect(cn("foo")).toBe("foo")
	})

	it("merges multiple class names with a space", () => {
		expect(cn("foo", "bar")).toBe("foo bar")
	})

	it("omits falsy conditional values", () => {
		expect(cn("foo", false && "bar", "baz")).toBe("foo baz")
		expect(cn("foo", undefined, "baz")).toBe("foo baz")
		expect(cn("foo", null, "baz")).toBe("foo baz")
	})

	it("resolves tailwind conflicts by keeping the last value", () => {
		// tailwind-merge: p-8 wins over p-4
		expect(cn("p-4", "p-8")).toBe("p-8")
	})

	it("merges object syntax (clsx shorthand)", () => {
		expect(cn({ foo: true, bar: false, baz: true })).toBe("foo baz")
	})

	it("returns an empty string when all values are falsy", () => {
		expect(cn(false, null, undefined)).toBe("")
	})
})
