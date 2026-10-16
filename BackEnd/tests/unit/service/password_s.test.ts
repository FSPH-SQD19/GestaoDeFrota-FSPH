import { describe, expect, it } from 'vitest'
import { comparePassword, hashPassword } from '../../../src/service/password_s'

describe('password service', () => {
  it('gera hashes diferentes para a mesma senha e verifica o valor original', async () => {
    const senha = 'senha-sintetica-de-teste'
    const first = await hashPassword(senha)
    const second = await hashPassword(senha)

    expect(first).not.toBe(senha)
    expect(first).not.toBe(second)
    expect(await comparePassword(senha, first)).toBe(true)
    expect(await comparePassword('senha-incorreta', first)).toBe(false)
  })
})
