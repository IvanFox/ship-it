# Ship It

Raycast extension to deploy services via `sdc`. Auto-discovers services from repository structure, integrates with Linear for ticket selection, and copies PR links to clipboard for Slack sharing.

## Local Setup

### Prerequisites

- [Raycast](https://raycast.com/) installed
- [Node.js](https://nodejs.org/) >= 18
- `sdc` CLI available on your system

### Install and Run

```bash
git clone <repo-url> ship-it
cd ship-it
npm install
npm run dev
```

`npm run dev` opens the extension in Raycast in development mode. Changes to source files hot-reload automatically.

### Configure Preferences

On first launch, Raycast prompts you to set required preferences. You can also edit them later via Raycast Settings → Extensions → Ship It.

| Preference | Required | Description |
|---|---|---|
| **Projects Directory** | Yes | Root directory containing all your repository clones (e.g., `~/Projects`) |
| **Ignored Directories** | No | Comma-separated directory names to skip during service discovery. `common` and `pkg` are always ignored. |
| **sdc Binary Path** | No | Absolute path to `sdc`. Leave empty if `sdc` is on your PATH. |

### Linear Authentication

The first time you select a ticket, Raycast triggers the Linear OAuth flow. Authenticate through your Okta SSO as usual. The token is cached locally — you only need to do this once.

If Linear auth fails, you can still type a ticket identifier manually in the dropdown.

## Commands

### Deploy Service

1. Select a **repository** from your projects directory
2. Pick a **service** (auto-discovered from `services/` subdirectories)
3. Choose a **Linear ticket** from your assigned issues
4. Select a **deploy target**:
   - `Unstable` / `Staging` — deploys from current branch
   - `Sandbox` / `Live` — checks out `main`, pulls latest, then deploys (creates PRs)
   - `All Environments` — checks out `main`, pulls latest, deploys to all four in order

When sandbox or live PRs are created, their URLs are copied to your clipboard for pasting into Slack.

### Manage Service Overrides

Service names are auto-discovered from directory structure. When the discovered name is incorrect, edit it in the deploy form — the override persists for next time.

Use this command to view, and delete saved overrides.

## Project Structure

```
src/
├── deploy.tsx              # Deploy command (form UI + orchestration)
├── manage-overrides.tsx    # Override management command
├── types.ts                # Shared types and stage definitions
└── lib/
    ├── services.ts         # Service discovery from filesystem
    ├── sdc.ts              # sdc CLI wrapper + PR URL parsing
    ├── linear.ts           # Linear OAuth + ticket fetching
    ├── slack.ts            # Slack message builder
    └── storage.ts          # LocalStorage helpers for overrides
```
