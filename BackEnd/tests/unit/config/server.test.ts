import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ listen: vi.fn(), getAuthConfig: vi.fn() }))
vi.mock('../../../src/app', () => ({ app: { listen: mocks.listen } }))
vi.mock('../../../src/config/auth', () => ({ getAuthConfig: mocks.getAuthConfig }))
vi.mock('dotenv/config', () => ({}))

beforeEach(() => {
    vi.resetModules()
    mocks.getAuthConfig.mockReset()
})

it('falha antes de abrir a porta quando a chave local não pode ser carregada', async () => {
    mocks.getAuthConfig.mockImplementation(() => { throw new Error('Chave local indisponível') })
    await expect(import('../../../src/server')).rejects.toThrow('Chave local indisponível')
    expect(mocks.listen).not.toHaveBeenCalled()
})

it('abre a porta depois de carregar a chave local', async () => {
    mocks.getAuthConfig.mockReturnValue({ secret: 'sintetico', expiresIn: 28800 })
    vi.stubEnv('PORT', '3456')
    await import('../../../src/server')
    expect(mocks.listen).toHaveBeenCalledWith(3456, '0.0.0.0', expect.any(Function))
    expect(mocks.getAuthConfig.mock.invocationCallOrder[0]).toBeLessThan(mocks.listen.mock.invocationCallOrder[0])
})
