import { describe, expect, it } from "vitest";
import { cn } from "../../../src/lib/utils";

describe("cn", () => {
  it("preserva classes condicionais e ignora valores falsos", () => {
    expect(cn("p-2", { "font-bold": true, hidden: false }, null, undefined, false)).toBe(
      "p-2 font-bold",
    );
  });

  it("permite que a classe informada por ultimo sobrescreva uma classe Tailwind conflitante", () => {
    expect(cn("p-2 text-sm", "p-6")).toBe("text-sm p-6");
  });

  it("mantem regras de hover separadas das regras do estado normal", () => {
    expect(cn("bg-white hover:bg-blue-500", "hover:bg-red-500")).toBe("bg-white hover:bg-red-500");
  });
});
