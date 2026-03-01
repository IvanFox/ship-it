/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Projects Directory - Root directory containing all repository clones */
  "projectsDirectory": string,
  /** Ignored Directories - Comma-separated directory names to skip in service discovery (common and pkg are always ignored) */
  "ignoredDirectories": string,
  /** sdc Binary Path - Absolute path to the sdc binary. Leave empty to use PATH lookup. */
  "sdcPath": string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `deploy` command */
  export type Deploy = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `deploy` command */
  export type Deploy = {}
}

