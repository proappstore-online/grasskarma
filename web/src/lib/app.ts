import { initPro } from '@proappstore/sdk'

// No `dataApiBase` override: in platform-cookie mode the SDK defaults it to the
// same-origin `/.pas/data` mediation path, which is the only path that carries
// the HttpOnly session. A cross-origin data URL gets no credentials, 401s, and
// the SDK signs the user straight back out (#1).
export const app = initPro({
  appId: 'grasskarma',
  authMode: 'platform-cookie',
})
