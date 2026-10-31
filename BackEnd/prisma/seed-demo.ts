import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/service/password_s";

const prisma = new PrismaClient();
const namespace = "frota-demo-v1";
function id(key: string) {
  const hex = createHash("sha256").update(`${namespace}:${key}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
const accounts = [
  { key: "admin", nome: "Administrador DEMO", perfil: "ADMIN" },
  { key: "gestor", nome: "Gestor DEMO", perfil: "GESTOR" },
  { key: "motorista", nome: "Motorista Administrativo DEMO", perfil: "MOTORISTA" },
  { key: "svo", nome: "Atendente SVO DEMO", perfil: "SVO" },
  { key: "solicitante", nome: "Solicitante DEMO", perfil: "SOLICITANTE" },
  { key: "motorista.svo", nome: "Motorista SVO DEMO", perfil: "MOTORISTA" },
  { key: "motorista.reserva", nome: "Motorista Reserva DEMO", perfil: "MOTORISTA" },
].map((account) => ({
  ...account,
  email: `${account.key}@demo.frota.test`,
  id: id(`usuario:${account.key}`),
}));

async function main() {
  if (process.env.NODE_ENV === "production")
    throw new Error("O seed de demonstração é exclusivo de desenvolvimento/homologação.");
  const destination = new URL(process.env.DATABASE_URL || "");
  const database = `${destination.hostname}${destination.pathname}`;
  console.log(`Banco de demonstração: ${database}`);
  const credentialsPath = resolve(__dirname, "../.runtime/demo-access.json");
  let password: string;
  if (existsSync(credentialsPath)) {
    const previous = JSON.parse(readFileSync(credentialsPath, "utf8")) as {
      banco: string;
      senha: string;
    };
    if (
      previous.banco !== database ||
      typeof previous.senha !== "string" ||
      previous.senha.length < 6
    )
      throw new Error(
        "O arquivo de acessos de demonstração pertence a outro destino ou está inválido.",
      );
    password = previous.senha;
  } else {
    if (
      await prisma.usuario.count({
        where: { email: { in: accounts.map((account) => account.email) } },
      })
    )
      throw new Error(
        "Já há contas DEMO e o arquivo de senhas não está disponível. O seed não redefine senhas existentes.",
      );
    password = randomBytes(12).toString("base64url");
    mkdirSync(resolve(__dirname, "../.runtime"), { recursive: true });
    writeFileSync(
      credentialsPath,
      JSON.stringify(
        {
          banco: database,
          senha: password,
          usuarios: accounts.map(({ email, perfil }) => ({ email, perfil })),
        },
        null,
        2,
      ) + "\n",
      { flag: "wx", mode: 0o600 },
    );
  }
  const hashes = await Promise.all(accounts.map(() => hashPassword(password)));
  const today =
    process.env.SEED_DEMO_DATE ||
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const anchor = new Date(`${today}T12:00:00-03:00`);
  if (!Number.isFinite(anchor.getTime()))
    throw new Error("SEED_DEMO_DATE inválida; use AAAA-MM-DD.");
  const day = (offset: number, hour = 9) => {
    const date = new Date(anchor);
    date.setUTCDate(date.getUTCDate() + offset);
    date.setUTCHours(hour + 3, 0, 0, 0);
    return date;
  };
  const year = Number(today.slice(0, 4));
  const user = (key: string) => id(`usuario:${key}`);
  const vehicle = (index: number) => id(`veiculo:${index}`);
  const driver = (index: number) => id(`motorista:${index}`);
  const vendor = (index: number) => id(`fornecedor:${index}`);

  await prisma.$transaction(
    async (tx) => {
      for (const [index, account] of accounts.entries()) {
        const perfil = await tx.perfil.upsert({
          where: { nome: account.perfil },
          update: {},
          create: { nome: account.perfil, descricao: `Perfil ${account.perfil}` },
        });
        const usuario = await tx.usuario.upsert({
          where: { email: account.email },
          update: {},
          create: {
            id: account.id,
            nome: account.nome,
            email: account.email,
            senhaHash: hashes[index],
          },
        });
        if (usuario.id !== account.id)
          throw new Error(`A conta ${account.email} já existe e não pertence a este seed.`);
        await tx.usuarioPerfil.upsert({
          where: { usuarioId_perfilId: { usuarioId: usuario.id, perfilId: perfil.id } },
          update: {},
          create: { usuarioId: usuario.id, perfilId: perfil.id },
        });
      }
      const vendors = [
        { razaoSocial: "Locadora DEMO", cnpj: "11.222.333/0001-81", tipoServico: "LOCADORA" },
        { razaoSocial: "Oficina DEMO", cnpj: "22.333.444/0001-81", tipoServico: "OFICINA" },
        { razaoSocial: "Posto DEMO", cnpj: "33.444.555/0001-81", tipoServico: "POSTO_PRIME" },
      ];
      for (const [i, data] of vendors.entries())
        await tx.fornecedor.upsert({
          where: { id: vendor(i) },
          update: {},
          create: { id: vendor(i), ...data },
        });
      const vehicles = [
        {
          modelo: "Chevrolet Onix DEMO",
          tipoFrota: "ADMINISTRATIVA",
          status: "EM_VIAGEM",
          odometroAtual: 38400,
        },
        {
          modelo: "Toyota Corolla DEMO",
          tipoFrota: "ADMINISTRATIVA",
          status: "DISPONIVEL",
          odometroAtual: 45000,
        },
        {
          modelo: "Fiat Cronos DEMO",
          tipoFrota: "ADMINISTRATIVA",
          status: "DISPONIVEL",
          odometroAtual: 52000,
        },
        {
          modelo: "Renault Master DEMO",
          tipoFrota: "ADMINISTRATIVA",
          status: "MANUTENCAO",
          odometroAtual: 68000,
        },
        {
          modelo: "Toyota Hilux SVO DEMO",
          tipoFrota: "SVO",
          status: "EM_VIAGEM",
          odometroAtual: 73000,
        },
        {
          modelo: "Chevrolet S10 SVO DEMO",
          tipoFrota: "SVO",
          status: "DESINFECCAO",
          odometroAtual: 61000,
        },
        {
          modelo: "Fiat Toro SVO DEMO",
          tipoFrota: "SVO",
          status: "DISPONIVEL",
          odometroAtual: 29000,
        },
        {
          modelo: "Volkswagen Gol Inativo DEMO",
          tipoFrota: "ADMINISTRATIVA",
          status: "DISPONIVEL",
          odometroAtual: 92000,
        },
      ];
      for (const [i, data] of vehicles.entries()) {
        await tx.veiculo.upsert({
          where: { id: vehicle(i) },
          update: {},
          create: {
            id: vehicle(i),
            placa: `DMO${i + 1}A0${i + 1}`,
            ...data,
            ano: 2021 + (i % 4),
            propriedade: i === 2 ? "LOCADO" : "PROPRIO",
            fornecedorId: i === 2 ? vendor(0) : null,
            capacidadeMaxima: i === 3 ? 12 : 4,
            combustivel: i >= 3 && i <= 5 ? "DIESEL" : "FLEX",
            ativo: i !== 7,
            criadoEm: day(-90),
          },
        });
        await tx.documentoVeiculo.upsert({
          where: { id: id(`documento:${i}`) },
          update: {},
          create: {
            id: id(`documento:${i}`),
            veiculoId: vehicle(i),
            tipoDocumento: "CRLV",
            dataVencimento: day(i === 3 ? -5 : 60 + i * 15),
            status: i === 3 ? "VENCIDO" : "VIGENTE",
          },
        });
      }
      const drivers = [
        { key: "motorista", cpf: "11144477735", numeroCnh: "90000000001", status: "OCUPADO" },
        { key: "motorista.svo", cpf: "52998224725", numeroCnh: "90000000002", status: "OCUPADO" },
        {
          key: "motorista.reserva",
          cpf: "12345678909",
          numeroCnh: "90000000003",
          status: "DISPONIVEL",
        },
      ];
      for (const [i, data] of drivers.entries())
        await tx.motorista.upsert({
          where: { id: driver(i) },
          update: {},
          create: {
            id: driver(i),
            usuarioId: user(data.key),
            cpf: data.cpf,
            numeroCnh: data.numeroCnh,
            status: data.status,
            categoriaCnh: "D",
            validadeCnh: day(730),
            telefone: `(79) 90000-000${i + 1}`,
          },
        });

      async function nextProtocol(prefixo: string) {
        const counter = await tx.contadorProtocolo.upsert({
          where: { prefixo_ano: { prefixo, ano: year } },
          create: { prefixo, ano: year, ultimoValor: 1 },
          update: { ultimoValor: { increment: 1 } },
        });
        return `${prefixo}-${year}-${String(counter.ultimoValor).padStart(4, "0")}`;
      }
      for (let i = 0; i < 12; i++) {
        const tripId = id(`solicitacao:${i}`);
        if (await tx.solicitacaoViagem.findUnique({ where: { id: tripId }, select: { id: true } }))
          continue;
        const completed = i < 6,
          inProgress = i === 7,
          approved = i === 6,
          refused = i === 11;
        const offset = completed ? -20 + i * 3 : approved ? 1 : inProgress ? 0 : i - 6;
        const vehicleIndex = inProgress ? 0 : i % 2 ? 2 : 1;
        const driverIndex = approved ? 2 : completed && i % 2 ? 2 : 0;
        const assigned = completed || inProgress || approved;
        await tx.solicitacaoViagem.create({
          data: {
            id: tripId,
            protocolo: await nextProtocol("SV"),
            solicitanteId: user("solicitante"),
            setorOrigem: ["LACEN DEMO", "Administrativo DEMO", "SVO DEMO"][i % 3],
            origem: "Sede fictícia DEMO — Aracaju/SE",
            destino: [
              "Unidade fictícia DEMO — São Cristóvão/SE",
              "Laboratório fictício DEMO — Aracaju/SE",
              "Almoxarifado fictício DEMO — Socorro/SE",
            ][i % 3],
            dataHoraPretendida: day(offset),
            dataHoraRetornoPrevista: day(offset, 16),
            quantidadePassageiros: (i % 4) + 1,
            tipoTransporte: i % 3 === 0 ? "MATERIAL_BIOLOGICO" : "PASSAGEIROS",
            urgencia: i === 9 ? "URGENTE" : "NORMAL",
            status: completed
              ? "CONCLUIDA"
              : approved
                ? "APROVADA"
                : inProgress
                  ? "EM_TRANSITO"
                  : refused
                    ? "RECUSADA"
                    : "PENDENTE",
            justificativa: "Dados fictícios de demonstração para validar o fluxo de transporte.",
            observacoes: "DEMO — sem dados operacionais reais.",
            motivoRecusa: refused
              ? "DEMO: transporte solicitado fora do escopo institucional."
              : null,
            veiculoAlocadoId: assigned ? vehicle(vehicleIndex) : null,
            motoristaAlocadoId: assigned ? driver(driverIndex) : null,
            criadoEm: day(offset - 2),
          },
        });
        if (completed || inProgress) {
          const km = inProgress ? 38300 : (vehicleIndex === 2 ? 50000 : 40000) + i * 150;
          await tx.execucaoViagem.create({
            data: {
              id: id(`execucao:${i}`),
              solicitacaoId: tripId,
              dataHoraInicio: day(offset),
              dataHoraFim: completed ? day(offset, 15) : null,
              kmInicial: km,
              kmFinal: completed ? km + 80 + i * 12 : null,
              checklistSaida: { demonstracao: true, pneus: true, documentos: true },
              checklistRetorno: completed
                ? { demonstracao: true, semOcorrencias: true }
                : Prisma.JsonNull,
            },
          });
        }
      }
      for (let i = 0; i < 10; i++)
        await tx.abastecimento.upsert({
          where: { id: id(`abastecimento:${i}`) },
          update: {},
          create: {
            id: id(`abastecimento:${i}`),
            veiculoId: vehicle(i % 2 ? 2 : 1),
            motoristaId: driver(i % 2 ? 2 : 0),
            fornecedorId: vendor(2),
            dataHora: day(-28 + i * 3),
            odometro: (i % 2 ? 50000 : 40000) + i * 100,
            litros: 30 + i * 2,
            valorTotal: new Prisma.Decimal(30 + i * 2).mul("5.90"),
          },
        });
      for (let i = 0; i < 4; i++)
        await tx.manutencao.upsert({
          where: { id: id(`manutencao:${i}`) },
          update: {},
          create: {
            id: id(`manutencao:${i}`),
            veiculoId: vehicle(i === 0 ? 3 : i % 2 ? 1 : 2),
            fornecedorId: vendor(1),
            tipo: i === 0 ? "CORRETIVA" : "PREVENTIVA",
            descricao:
              i === 0
                ? "DEMO: reparo do sistema de freios em andamento."
                : "DEMO: revisão e troca de óleo concluídas.",
            odometroRegistro: i === 0 ? 68000 : i === 3 ? 40100 : i % 2 ? 39500 : 49500,
            custoTotal: i === 0 ? 1800 : 450 + i * 120,
            dataManutencao: day(i === 0 ? -1 : -25 + i * 3),
            status: i === 0 ? "ABERTA" : "CONCLUIDA",
            dataConclusao: i === 0 ? null : day(-24 + i * 3),
          },
        });

      for (let i = 0; i < 7; i++) {
        const callId = id(`chamado:${i}`);
        if (await tx.chamadoSvo.findUnique({ where: { id: callId }, select: { id: true } }))
          continue;
        await tx.chamadoSvo.create({
          data: {
            id: callId,
            numeroProtocolo: await nextProtocol("SVO"),
            atendenteId: user("svo"),
            nomeFalecido: `Pessoa fictícia DEMO ${i + 1}`,
            enderecoOcorrencia: `Endereço fictício DEMO ${i + 1} — Aracaju/SE`,
            relatoOcorrencia: "Cenário inteiramente fictício para demonstração do fluxo SVO.",
            statusTriagem: i < 2 ? "EM_ANALISE" : i === 6 ? "RECUSADO" : "APROVADO",
          },
        });
        if (i >= 3 && i <= 5)
          await tx.ordemColetaSvo.create({
            data: {
              id: id(`ordem:${i}`),
              chamadoId: callId,
              veiculoId: vehicle(i + 1),
              motoristaId: driver(1),
              status: i === 3 ? "EM_ANDAMENTO" : "CONCLUIDA",
              dataHoraSaida: day(i === 3 ? 0 : -2, 8),
              numeroDeclaracaoObito: `DEMO-${year}-${i}`,
            },
          });
      }
      for (let i = 0; i < 2; i++)
        await tx.desinfeccaoSvo.upsert({
          where: { id: id(`desinfeccao:${i}`) },
          update: {},
          create: {
            id: id(`desinfeccao:${i}`),
            veiculoId: vehicle(i + 5),
            responsavelId: user("svo"),
            status: i === 0 ? "EM_ANDAMENTO" : "CONCLUIDA",
            dataHoraInicio: day(i === 0 ? 0 : -2, 10),
            dataHoraConclusao: i === 0 ? null : day(-2, 11),
          },
        });
      await tx.auditoriaSistema.upsert({
        where: { id: id("auditoria:seed") },
        update: {},
        create: {
          id: id("auditoria:seed"),
          usuarioId: user("admin"),
          acao: "SEED_DEMO",
          tabelaAfetada: "dados_demonstracao",
          dadosNovos: { demonstracao: true, versao: namespace, dataReferencia: today },
          criadoEm: day(0, 12),
        },
      });
    },
    { maxWait: 15_000, timeout: 120_000 },
  );
  console.log(
    "Demonstração criada: 7 usuários, 5 perfis, 3 motoristas, 8 veículos, 3 fornecedores, 12 viagens, 10 abastecimentos, 4 manutenções e 7 chamados SVO.",
  );
  console.log(`Acessos e senha: ${credentialsPath} (ignorado pelo Git).`);
}
main()
  .catch((error: unknown) => {
    console.error(
      "Falha no seed de demonstração:",
      error instanceof Error ? error.message : "erro desconhecido",
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
