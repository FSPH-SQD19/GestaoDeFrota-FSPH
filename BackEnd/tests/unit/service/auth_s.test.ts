import jwt, { type JwtPayload } from 'jsonwebtoken'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  comparePassword: vi.fn(),
}))

vi.mock('../../../src/lib/prisma', () => ({
  prisma: { usuario: { findUnique: mocks.findUnique } },
}))
vi.mock('../../../src/service/password_s', () => ({
  comparePassword: mocks.comparePassword,
}))

import { login } from '../../../src/service/auth_s'

const credentials = { email: 'teste@example.test', senha: 'senha-de-teste' }
const secret = 'chave-sintetica-exclusiva-dos-testes'
const usuario = {
  id: '00000000-0000-4000-8000-000000000001',
  nome: 'Usuario de teste',
  email: credentials.email,
  senhaHash: 'hash-sintetico',
  ativo: true,
  perfis: [{ perfil: { nome: 'GESTOR' } }],
}

describe('login service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('JWT_SECRET', secret)
    mocks.findUnique.mockResolvedValue(usuario)
    mocks.comparePassword.mockResolvedValue(true)
  })

  it('recusa usuario inexistente sem comparar senhas', async () => {
    mocks.findUnique.mockResolvedValue(null)

    await expect(login(credentials)).rejects.toThrow('Credenciais inválidas')
    expect(mocks.comparePassword).not.toHaveBeenCalled()
  })

  it('recusa usuario inativo sem comparar senhas', async () => {
    mocks.findUnique.mockResolvedValue({ ...usuario, ativo: false })

    await expect(login(credentials)).rejects.toThrow('Credenciais inválidas')
    expect(mocks.comparePassword).not.toHaveBeenCalled()
  })

  it('recusa senha incorreta', async () => {
    mocks.comparePassword.mockResolvedValue(false)

    await expect(login(credentials)).rejects.toThrow('Credenciais inválidas')
    expect(mocks.comparePassword).toHaveBeenCalledWith(credentials.senha, usuario.senhaHash)
  })

  it('assina token com usuario e perfis sem expor o hash da senha', async () => {
    const result = await login(credentials)
    const payload = jwt.verify(result.token, secret) as JwtPayload

    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { email: credentials.email },
      include: { perfis: { include: { perfil: true } } },
    })
    expect(result.usuario).toEqual({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfis: ['GESTOR'],
    })
    expect(payload).toMatchObject({ sub: usuario.id, perfis: ['GESTOR'] })
    expect(payload.exp! - payload.iat!).toBe(8 * 60 * 60)
    expect(() => jwt.verify(result.token, 'outra-chave')).toThrow()
  })

  it('recusa gerar token sem JWT_SECRET', async () => {
    vi.stubEnv('JWT_SECRET', undefined)

    await expect(login(credentials)).rejects.toThrow('JWT_SECRET não definido')
  })

  it('propaga a falha do banco para o controller', async () => {
    const failure = new Error('Banco indisponivel')
    mocks.findUnique.mockRejectedValue(failure)

    await expect(login(credentials)).rejects.toBe(failure)
    expect(mocks.comparePassword).not.toHaveBeenCalled()
  })
})
