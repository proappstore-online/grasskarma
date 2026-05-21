import { initPro } from '@proappstore/sdk'

// The SDK's default `dataApiBase` is `https://data-{appId}.proappstore.online`
// but the platform's current provisioner deploys the per-app data Worker at
// the `workers.dev` hostname only — the data-* subdomain DNS records aren't
// created. Sibling apps dating + carsads have the same workaround; see
// platform/PLATFORM-NOTES.md.
export const app = initPro({
  appId: 'grasskarma',
  dataApiBase: 'https://pas-data-grasskarma.serge-the-dev.workers.dev',
})

export async function dbQuery<T>(sql: string, params?: unknown[]): Promise<T[]> {
  try {
    const r = await app.db.query<T>(sql, params)
    return r.rows
  } catch (err) {
    console.error('DB query failed:', sql, err)
    return []
  }
}

export async function dbExec(sql: string, params?: unknown[]) {
  return app.db.execute(sql, params)
}
