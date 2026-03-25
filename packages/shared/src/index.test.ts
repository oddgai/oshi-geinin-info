import { describe, it, expect } from "vitest";
import { parseDatetime, parseMinPrice } from "./index";

describe("parseDatetime", () => {
  it("parses standard format", () => {
    const result = parseDatetime("2026年4月1日(水) 開場18:00 開演18:30");
    expect(result).toEqual(new Date(2026, 3, 1, 18, 0));
  });

  it("returns null for unparseable text", () => {
    expect(parseDatetime("日時未定")).toBeNull();
  });
});

describe("parseMinPrice", () => {
  it("extracts minimum price", () => {
    expect(parseMinPrice("前売3,500円 / 当日4,000円")).toBe(3500);
  });

  it("handles single price", () => {
    expect(parseMinPrice("5,000円")).toBe(5000);
  });

  it("returns null for no price", () => {
    expect(parseMinPrice("料金未定")).toBeNull();
  });
});
