import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readD1Config } from "./shared/d1-config";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));
vi.mock("@nerdfolio/drizzle-d1-helpers", () => ({ D1Helper: {} }));
import { escapeSql, runWranglerSQL } from "./overwriteRemoteDBIllustrationsAndPrompts";

afterEach(() => vi.restoreAllMocks());

describe("script compatibility", () => {
  it("parses JSONC without stripping URL content or confusing staging with production", () => {
    const config = `{
      // The URL contains characters a comment regex must not strip.
      "url": "https://example.test",
      "d1_databases": [{"binding":"DB","database_id":"prod-id","database_name":"prod",}],
      "env": {"staging":{"d1_databases":[{"binding":"DB","database_id":"stage-id","database_name":"stage"}]}},
    }`;
    expect(readD1Config(config, "prod").databaseId).toBe("prod-id");
    expect(readD1Config(config, "staging").databaseId).toBe("stage-id");
    expect(() => readD1Config('{"d1_databases":[]}', "staging")).toThrow(/staging/);
  });

  it("round-trips SQL strings containing quotes, backslashes and shell syntax", () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      const text = "O'Brien \\ path \"quoted\" `literal` $(literal)";
      expect(sqlite.prepare(`SELECT ${escapeSql(text)} AS value`).get()).toEqual({ value: text });
      expect(escapeSql(null)).toBe("NULL");
      vi.mocked(execFileSync).mockReturnValue('[{"success":true}]');
      runWranglerSQL(`SELECT ${escapeSql(text)}`, true);
      const args = vi.mocked(execFileSync).mock.calls.at(-1)![1] as string[];
      expect(args).toContain(`SELECT ${escapeSql(text)}`);
      expect(args).toContain("--local");
    } finally { sqlite.close(); }
  });

  it("stops on a rejected D1 statement", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(execFileSync).mockReturnValue('[{"success":false}]');
    expect(() => runWranglerSQL("SELECT 1", true)).toThrow(/rejected/);
  });
});
