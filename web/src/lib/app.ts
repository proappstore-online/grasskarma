import { initPro } from '@proappstore/sdk'

// The SDK's default `dataApiBase` is `https://data-{appId}.proappstore.online`
// but the platform's current provisioner deploys the per-app data Worker at
// the `workers.dev` hostname only — the data-* subdomain DNS records aren't
// created. Sibling apps dating + carsads have the same workaround; see
// platform/PLATFORM-NOTES.md.
export const app = initPro({
  appId: 'grasskarma',
  authMode: 'platform-cookie',
  dataApiBase: 'https://pas-data-grasskarma.serge-the-dev.workers.dev',
})
