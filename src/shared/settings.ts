/**
 * The settings namespace this plugin owns, and the one field in it.
 *
 * Shared rather than duplicated because the two halves must agree on the exact
 * strings and cannot import each other's runtime modules: the host half registers
 * the namespace, the browser half binds to it by name, and a typo in either would
 * fail as "the setting does not stick" rather than as an error.
 */

/**
 * The namespace. Must match `^[a-z][a-z0-9-]*$` — that is the host registry's
 * rule, and a name that violates it fails at registration, at boot.
 */
export const SETTINGS_NAMESPACE = 'spreadjs-editor'

/** The field holding the id of the chosen bridge. */
export const BRIDGE_FIELD = 'bridge'

/**
 * What an unset field means.
 *
 * Omitted rather than defaulted to a name: "nothing chosen" is a real state — no
 * provider installed, or the chosen one uninstalled since — and defaulting to
 * whichever bridge happened to register would make the user's absence of a
 * choice look like a choice.
 */
export const NO_BRIDGE = ''
