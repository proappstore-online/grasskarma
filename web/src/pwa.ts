// PAS endpoints are handled by the platform, not the React router. In
// particular, OAuth redirects navigate through `/.pas/auth/start` and
// `/.pas/auth/callback`, where the platform creates the HttpOnly session.
//
// Workbox evaluates this list against URL pathnames before serving the SPA
// shell. Keep the expression deliberately small and anchored because it runs
// for every navigation.
export const platformNavigationDenylist = [/^\/\.pas\//]
