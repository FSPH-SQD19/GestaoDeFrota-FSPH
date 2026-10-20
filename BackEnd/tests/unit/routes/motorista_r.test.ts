import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import jwt from 'jsonwebtoken'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn() }))
vi.mock('../../../src/lib/prisma', () => ({
    prisma: {
        motorista: { findFirst: mocks.findFirst, create: mocks.create },
        usuario: { findUnique: mocks.findUnique },
    },
}))
vi.mock('../../../src/config/auth', () => ({
    getAuthConfig: () => ({ secret: 'segredo-sintetico-motoristas', expiresIn: 28800 }),
}))

import { app } from '../../../src/app'

let server: Server
let baseUrl: string
const usuarioId = '00000000-0000-4000-8000-000000000001'
const entrada = { cpf: '12345678909', numeroCnh: '12345678901', categoriaCnh: 'B', validadeCnh: '2026-10-20' }

beforeAll(async () => {
    server = app.listen(0, '127.0.0.1')
    await new Promise(resolve => server.once('listening', resolve))
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(() => new Promise(resolve => server.close(resolve)))
beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-21T02:59:59.999Z'))
    mocks.findFirst.mockResolvedValue(null)
    mocks.findUnique.mockResolvedValue({ id: usuarioId })
    mocks.create.mockResolvedValue({ id: 'motorista-sintetico', ...entrada })
})
afterEach(() => vi.useRealTimers())

async function cadastrar(body?: unknown) {
    const token = jwt.sign({ perfis: ['ADMIN'] }, 'segredo-sintetico-motoristas', { subject: usuarioId })
    const response = await fetch(`${baseUrl}/motoristas`, {
        method: 'POST',
        headers: {
            authorization: `Bearer ${token}`,
            ...(body !== undefined && { 'content-type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    })
    return { status: response.status, body: await response.json() }
}

describe('POST /motoristas', () => {
    it.each([
        { caso: 'corpo ausente', body: undefined },
        { caso: 'objeto vazio', body: {} },
        { caso: 'corpo nulo', body: null },
    ])('retorna 400 para $caso sem consultar o banco', async ({ body }) => {
        expect((await cadastrar(body)).status).toBe(400)
        expect(mocks.findFirst).not.toHaveBeenCalled()
        expect(mocks.create).not.toHaveBeenCalled()
    })

    it.each(['abc', '', '   ', null, 123, '00000000-0000-4000-8000-00000000000z'])(
        'retorna 400 para usuarioId inválido %j sem consultar o banco', async usuarioId => {
            expect(await cadastrar({ ...entrada, usuarioId })).toEqual({ status: 400, body: { mensagem: 'usuarioId inválido.' } })
            expect(mocks.findFirst).not.toHaveBeenCalled()
            expect(mocks.findUnique).not.toHaveBeenCalled()
            expect(mocks.create).not.toHaveBeenCalled()
        }
    )

    it('cadastra CNH que vence hoje às 23h59 em São Paulo', async () => {
        expect((await cadastrar({ ...entrada, usuarioId })).status).toBe(201)
        expect(mocks.create).toHaveBeenCalledOnce()
    })

    it('retorna 400 quando o dia da validade terminou em São Paulo', async () => {
        vi.setSystemTime(new Date('2026-10-21T03:00:00Z'))
        expect(await cadastrar(entrada)).toEqual({ status: 400, body: { mensagem: 'A CNH está vencida.' } })
        expect(mocks.findFirst).not.toHaveBeenCalled()
        expect(mocks.create).not.toHaveBeenCalled()
    })
})
