import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { AuthGate } from './AuthGate'

const signIn = vi.fn()
const retryProfileLoad = vi.fn()
let authState = {
  gate: 'signed-out',
  signIn,
  profileLoadError: null as Error | null,
  retryProfileLoad,
}
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => authState,
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

describe('AuthGate profile-load failure', () => {
  it('renders a recoverable error instead of the onboarding screen', () => {
    authState = {
      gate: 'profile-error',
      signIn,
      profileLoadError: new Error('profile request failed'),
      retryProfileLoad,
    }

    const markup = renderToStaticMarkup(<AuthGate>application</AuthGate>)

    expect(markup).toContain("We couldn&#x27;t load your profile")
    expect(markup).toContain('Try again')
    expect(markup).not.toContain('Are you here to hire a mower')
  })

  it('retries the profile load from the error screen', () => {
    authState = {
      gate: 'profile-error',
      signIn,
      profileLoadError: new Error('profile request failed'),
      retryProfileLoad,
    }
    retryProfileLoad.mockClear()

    const retryButton = findButtons(AuthGate({ children: null })).find((button) => button.props.children === 'Try again')
    retryButton!.props.onClick()

    expect(retryProfileLoad).toHaveBeenCalledOnce()
  })
})
