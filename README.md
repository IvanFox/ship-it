# Ship It

Raycast extension that wraps the `sdc` CLI to deploy services. Eliminates the repetitive workflow of remembering service names, typing sdc flags, switching branches, and manually copying PR links into Slack.

## The Problem

Deploying a service with `sdc` requires:

1. Navigating to the correct repo directory
2. Remembering the exact service name (which may differ from the directory name)
3. Running `git checkout main && git pull` for sandbox/live deploys
4. Typing the full `sdc -d -s <service> -stage <stage> -ignore-tests -y -t <ticket>` command
5. Waiting for output, then manually copying PR URLs
6. Formatting and pasting PR links into Slack

Multiply this by multiple services and environments, and it becomes tedious and error-prone.

## What Ship It Does

- **Auto-discovers services** from repository directory structure
- **Handles git operations** automatically (checkout main + pull for sandbox/live)
- **Integrates with Linear** to select tickets from your assigned issues
- **Copies PR links** to clipboard in a Slack-ready format
- **Quick deploys** to unstable/staging directly from the service list — no ticket required

## Install

### Prerequisites

- [Raycast](https://raycast.com/)
- [Node.js](https://nodejs.org/) >= 18
- `sdc` CLI available on your system

### Setup

```bash
git clone <repo-url> ship-it
cd ship-it
make install
```

This installs dependencies and builds the extension for Raycast.

For development with hot-reload:

```bash
make dev
```

Run `make help` to see all available targets.

### Configure Preferences

On first launch, Raycast prompts for required preferences. Edit later via Raycast Settings → Extensions → Ship It.

| Preference | Required | Description |
|---|---|---|
| **Projects Directory** | Yes | Root directory containing all repository clones (e.g., `~/Projects`) |
| **Ignored Directories** | No | Comma-separated directory names to skip during service discovery. `common` and `pkg` are always ignored. |
| **sdc Binary Path** | No | Absolute path to `sdc`. Leave empty if `sdc` is in a standard location. |

### Linear Authentication

On first use, Raycast triggers the Linear OAuth flow. Authenticate through your SSO as usual. The token is cached locally.

## Usage

### Deploy Flow

1. **Select a repository** from your projects directory (`Cmd+D` to pin favorites)
2. **Pick a service** (auto-discovered from `services/` subdirectories)
3. **Quick deploy** or **full deploy**:
   - `Cmd+1` — Deploy to Unstable (immediate, no ticket needed)
   - `Cmd+2` — Deploy to Staging (immediate, no ticket needed)
   - `Enter` — Open deploy form for Sandbox, Live, or All Environments (requires a Linear ticket)

For sandbox/live deploys, `git checkout main && git pull` runs automatically before deploying. PR URLs are copied to clipboard in this format:

```
Deploying proxy-voting

• https://github.com/org/repo/pull/123
• https://github.com/org/repo/pull/124
```

### Service Name Overrides

When the auto-discovered service name is incorrect, press `Cmd+E` on the service list to rename it. The override persists across sessions. `Cmd+Shift+E` resets to the original name.

## Project Structure

```
src/
├── deploy.tsx           # Entry point, repo list
├── service-list.tsx     # Service list with quick deploy actions
├── deploy-form.tsx      # Deploy form (sandbox/live/all) + shared deploy logic
├── types.ts             # Shared types and stage definitions
└── lib/
    ├── services.ts      # Service discovery from filesystem
    ├── sdc.ts           # sdc CLI wrapper + PR URL parsing
    ├── linear.ts        # Linear OAuth + ticket fetching
    ├── slack.ts         # Slack message builder
    └── storage.ts       # LocalStorage helpers for overrides and pins
```
