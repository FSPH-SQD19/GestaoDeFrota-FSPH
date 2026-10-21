import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  perfil: { upsert: vi.fn(), findUniqueOrThrow: vi.fn() },
  usuario: { upsert: vi.fn() },
  usuarioPerfil: { upsert: vi.fn() },
  $disconnect: vi.fn(),
  hashPassword: vi.fn(),
}));
vi.mock("@prisma/client", () => ({
  PrismaClient: class {
    perfil = mocks.perfil;
    usuario = mocks.usuario;
    usuarioPerfil = mocks.usuarioPerfil;
    $disconnect = mocks.$disconnect;
  },
}));
vi.mock("../../../src/service/password_s", () => ({ hashPassword: mocks.hashPassword }));
vi.mock("dotenv/config", () => ({}));

// Persiste somente em memória e aplica as mesmas chaves únicas usadas pelos upserts.
type Row = Record<string, unknown>;
type Upsert = { where: Row; update: Row; create: Row };
function upsert(rows: Map<string, Row>, key: string, { create, update }: Upsert) {
  const previous = rows.get(key);
  const row = previous ? { ...previous, ...update } : { id: `sintetico-${rows.size}`, ...create };
  rows.set(key, row);
  return row;
}

it("executa o seed duas vezes sem duplicar usuários, perfis ou vínculos e atualiza os registros existentes", async () => {
  const perfis = new Map<string, Row>();
  const usuarios = new Map<string, Row>();
  const vinculos = new Map<string, Row>();
  const outro = { id: "outro-sintetico", nome: "Outro", ativo: false };
  usuarios.set("outro@example.test", outro);
  mocks.perfil.upsert.mockImplementation((args: Upsert) =>
    upsert(perfis, String(args.where.nome), args),
  );
  mocks.usuario.upsert.mockImplementation((args: Upsert) =>
    upsert(usuarios, String(args.where.email), args),
  );
  mocks.usuarioPerfil.upsert.mockImplementation((args: Upsert) => {
    const key = args.where.usuarioId_perfilId as { usuarioId: string; perfilId: string };
    expect(args.create).toEqual(key);
    return upsert(vinculos, `${key.usuarioId}/${key.perfilId}`, args);
  });
  mocks.perfil.findUniqueOrThrow.mockImplementation(({ where }: { where: { nome: string } }) => {
    const perfil = perfis.get(where.nome);
    if (!perfil) throw new Error("Perfil não encontrado");
    return perfil;
  });
  let hashCounter = 0;
  mocks.hashPassword.mockImplementation(async () => `hash-sintetico-${++hashCounter}`);
  mocks.$disconnect.mockResolvedValue(undefined);
  vi.spyOn(console, "log").mockImplementation(() => {});

  await import("../../../prisma/seed");
  await vi.waitFor(() => expect(mocks.$disconnect).toHaveBeenCalledTimes(1));
  expect(perfis.size).toBe(4);
  expect(usuarios.size).toBe(5);
  expect(vinculos.size).toBe(4);
  const ids = [...usuarios.values()].map((row) => row.id);
  const hashes = [...usuarios.values()].map((row) => row.senhaHash);
  const usuario = [...usuarios.values()][1];
  usuario.nome = "Nome alterado no teste";
  usuario.ativo = false;
  const perfil = [...perfis.values()][0];
  perfil.descricao = "Descrição alterada no teste";

  vi.resetModules();
  await import("../../../prisma/seed");
  await vi.waitFor(() => expect(mocks.$disconnect).toHaveBeenCalledTimes(2));
  expect(perfis.size).toBe(4);
  expect(usuarios.size).toBe(5);
  expect(vinculos.size).toBe(4);
  expect([...usuarios.values()].map((row) => row.id)).toEqual(ids);
  expect([...usuarios.values()].map((row) => row.senhaHash)).not.toEqual(hashes);
  expect([...usuarios.values()][1]).toMatchObject({ ativo: true });
  expect([...usuarios.values()][1].nome).not.toBe("Nome alterado no teste");
  expect([...perfis.values()][0].descricao).not.toBe("Descrição alterada no teste");
  expect(usuarios.get("outro@example.test")).toBe(outro);
  expect(mocks.hashPassword).toHaveBeenCalledTimes(8);
});
