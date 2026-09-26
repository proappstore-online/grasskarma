import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { AuthGate } from './AuthGate'

const signIn = vi.fn()
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ gate: 'signed-out', signIn }),
}))

type ButtonProps = { onClick: () => void; children: ReactNode }

function findButtons(node: ReactNode): ReactElement<ButtonProps>[] {
  if (!isValidElement<{ children?: ReactNode }>(node)) return []
  const own = node.type === 'button' ? [node as ReactElement<ButtonProps>] : []
  const kids = ([] as ReactNode[]).concat(node.props.children ?? [])
  return [...own, ...kids.flatMap(findButtons)]
}

// #1: the signed-out screen offered GitHub only.
describe('AuthGate signed-out screen', () => {
  const buttons = findButtons(AuthGate({ children: null }))

  it.each([
    ['Sign in with Google', 'google'],
    ['Sign in with GitHub', 'github'],
  ])('"%s" starts sign-in with %s', (label, provider) => {
    const button = buttons.find((b) => b.props.children === label)
    expect(button).toBeDefined()
    signIn.mockClear()
    button!.props.onClick()
    expect(signIn).toHaveBeenCalledWith(provider)
  })
})
