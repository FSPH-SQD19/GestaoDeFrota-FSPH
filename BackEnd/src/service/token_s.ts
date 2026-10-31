import jwt from "jsonwebtoken";
import { getAuthConfig } from "../config/auth";

const issuer = () => process.env.JWT_ISSUER || "fsph-frota-api";
const audience = () => process.env.JWT_AUDIENCE || "fsph-frota-web";

export function signToken(usuarioId: string, sessaoId: string) {
  const { secret, expiresIn } = getAuthConfig();
  return jwt.sign({}, secret, {
    algorithm: "HS256",
    issuer: issuer(),
    audience: audience(),
    subject: usuarioId,
    jwtid: sessaoId,
    expiresIn,
  });
}

export function verifyToken(token: string, secret: string) {
  const payload = jwt.verify(token, secret, {
    algorithms: ["HS256"],
    issuer: issuer(),
    audience: audience(),
  });
  if (
    typeof payload === "string" ||
    typeof payload.sub !== "string" ||
    !payload.sub.trim() ||
    typeof payload.jti !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.jti) ||
    !Number.isInteger(payload.exp) ||
    !Number.isInteger(payload.iat) ||
    payload.exp! <= payload.iat! ||
    payload.iat! > Math.floor(Date.now() / 1000) ||
    payload.exp! - payload.iat! > 8 * 60 * 60
  )
    throw new Error("Token inválido");
  return { usuarioId: payload.sub, sessaoId: payload.jti };
}
