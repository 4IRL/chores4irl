// Leaf module for the identifiers shared by every 4irl-notifs caller. It imports
// nothing, so the outbound modules and the routes can all depend on it without
// an import cycle.

// The application identifier registered with 4irl-notifs. Must match
// `^[a-z0-9][a-z0-9_]{0,62}$`.
export const NOTIFS_APP_ID = 'chores4irl';

// The app's display name on the shared ntfy setup page (the `name` query param).
export const NOTIFS_APP_DISPLAY_NAME = 'Chores4irl';

// The per-user topic. `-all` is this user's catch-all subscription topic; the
// hash namespaces it so topics aren't guessable across users.
export function personTopic(personHash: string): string {
  return `${NOTIFS_APP_ID}-${personHash}-all`;
}

// The person's ntfy account name. One account per person across all 4IRL apps,
// so it is a pure function of the person hash (no app id), matching 4irl-notifs.
export function ntfyUsername(personHash: string): string {
  return `u_${personHash}`;
}
