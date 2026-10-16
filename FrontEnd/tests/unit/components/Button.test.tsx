import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '../../../src/components/common/Button'

describe('Button', () => {
  it('executa a acao ao clicar em um botao habilitado', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<Button onClick={onClick}>Salvar</Button>)

    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(onClick).toHaveBeenCalledOnce()
  })

  it.each([
    { state: 'desabilitado', disabled: true, isLoading: false },
    { state: 'carregando', disabled: false, isLoading: true },
  ])('impede envio duplicado quando $state', async ({ disabled, isLoading }) => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<Button disabled={disabled} isLoading={isLoading} onClick={onClick}>Salvar</Button>)
    const button = screen.getByRole('button', { name: 'Salvar' })

    expect(button).toBeDisabled()
    await user.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })
})
