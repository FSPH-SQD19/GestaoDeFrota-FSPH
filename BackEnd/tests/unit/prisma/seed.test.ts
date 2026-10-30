import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  perfil: { upsert: vi.fn() },
  $disconnect: vi.fn(),
}));
vi.mock("@prisma/client", () => ({
  PrismaClient: class {
    perfil = mocks.perfil;
    $disconnect = mocks.$disconnect;
  },
}));
vi.mock("dotenv/config", () => ({}));

type Row = Record<string, unknown>;
type Upsert = { where: Row; update: Row; create: Row };
function upsert(rows: Map<string, Row>, key: string, { create, update }: Upsert) {
  const previous = rows.get(key);
  const row = previous ? { ...previous, ...update } : { id: `perfil-${rows.size}`, ...create };
  rows.set(key, row);
  return row;
}

it("cria e atualiza apenas os perfis de acesso, sem criar usuários de demonstração", async () => {
  const perfis = new Map<string, Row>();
  mocks.perfil.upsert.mockImplementation((args: Upsert) =>
    upsert(perfis, String(args.where.nome), args),
  );
  mocks.$disconnect.mockResolvedValue(undefined);
  vi.spyOn(console, "log").mockImplementation(() => {});

  await import("../../../prisma/seed");
  await vi.waitFor(() => expect(mocks.$disconnect).toHaveBeenCalledTimes(1));
  expect(perfis.size).toBe(5);
  const ids = [...perfis.values()].map((row) => row.id);
  const perfil = perfis.get("GESTOR");
  if (!perfil) throw new Error("Perfil não encontrado no teste.");
  perfil.descricao = "Descrição alterada no teste";

  vi.resetModules();
  await import("../../../prisma/seed");
  await vi.waitFor(() => expect(mocks.$disconnect).toHaveBeenCalledTimes(2));
  expect(perfis.size).toBe(5);
  expect([...perfis.values()].map((row) => row.id)).toEqual(ids);
  expect(perfis.get("GESTOR")?.descricao).toBe("Gestor da frota");
  expect(mocks.perfil.upsert).toHaveBeenCalledTimes(10);
});
