import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { validar } from "../lib/validar";
import { HttpError } from "../lib/http_error";
import { authenticate, requireRole } from "../middleware/http_m";
const router = Router();
router.use(authenticate, requireRole("ADMIN", "GESTOR"));
router.get("/", async (_req, res) => {
  res.json({ data: await prisma.sede.findMany({ orderBy: { nome: "asc" } }) });
});
router.post("/", requireRole("ADMIN"), async (req, res) => {
  const data = validar(z.object({ nome: z.string().trim().min(2).max(150) }).strict(), req.body);
  const existe = await prisma.sede.findFirst({
    where: { nome: { equals: data.nome, mode: "insensitive" } },
  });
  if (existe) throw new HttpError(409, "Já existe uma sede com esse nome.");
  try {
    return res.status(201).json(await prisma.sede.create({ data }));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new HttpError(409, "Já existe uma sede com esse nome.");
    }
    throw error;
  }
});
router.patch("/:id", requireRole("ADMIN"), async (req, res) => {
  const id = validar(z.uuid(), req.params.id);
  const data = validar(z.object({ ativo: z.boolean() }).strict(), req.body);
  if (!(await prisma.sede.findUnique({ where: { id } })))
    throw new HttpError(404, "Sede não encontrada.");
  res.json(await prisma.sede.update({ where: { id }, data }));
});
export default router;
