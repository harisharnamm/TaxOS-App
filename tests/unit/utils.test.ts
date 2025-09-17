import { describe, it, expect } from "vitest";
import { cn, generateTransactionId } from "@/lib/utils";

describe("utils", () => {
  it("cn merges classes", () => {
    expect(cn("a", "b")).toContain("a");
  });
  it("generateTransactionId returns prefix", () => {
    expect(generateTransactionId()).toMatch(/^txn_/);
  });
});


