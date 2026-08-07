import { readFileSync } from "node:fs";
import postcss, { type Declaration, type Rule } from "postcss";
import { describe, expect, it } from "vitest";

const stylesheet = postcss.parse(
  readFileSync(new URL("./SongView.css", import.meta.url), "utf8"),
);

function declarationsFor(selector: string): Record<string, string> {
  const declarations: Record<string, string> = {};

  stylesheet.walkRules((rule: Rule) => {
    const selectors = rule.selector.split(",").map((item) => item.trim());
    if (!selectors.includes(selector)) return;

    rule.walkDecls((declaration: Declaration) => {
      declarations[declaration.prop] = declaration.value;
    });
  });

  return declarations;
}

describe("SongView comment layout", () => {
  it("keeps long comments out of auto-fit sizing and scrolls them horizontally", () => {
    expect(
      declarationsFor("#content-wrapper.measuring-container .comment"),
    ).toMatchObject({ width: "0" });

    expect(declarationsFor(".chord-sheet .comment")).toMatchObject({
      "white-space": "pre",
      "min-width": "0",
      "max-width": "100%",
      "overflow-x": "auto",
      "overflow-y": "clip",
    });
  });
});
