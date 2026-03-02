import {
  Form,
  ActionPanel,
  Action,
  showToast,
  Toast,
  Clipboard,
  Color,
  getPreferenceValues,
  Detail,
  useNavigation,
} from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { join } from "path";
import { useState } from "react";
import { fetchAssignedTickets, LinearTicket } from "./lib/linear";
import { deploySingle, gitCheckoutMainAndPull } from "./lib/sdc";
import { buildSlackMessage } from "./lib/slack";
import { saveDeployToHistory } from "./lib/storage";
import {
  DeployResult,
  DeployTarget,
  STAGES_FOR_TARGET,
  requiresMainBranch,
  ServiceInfo,
  Preferences,
} from "./types";

function buildResultMarkdown(results: DeployResult[], error?: string): string {
  const lines: string[] = [];

  if (error) {
    lines.push(`## Error`, "", `> ${error}`, "");
  }

  for (const r of results) {
    lines.push(`## ${r.stage}`, "", "```", r.stdout.trim(), "```", "");
  }

  return lines.join("\n");
}

export function DeployResultView({
  serviceName,
  results,
  error,
}: {
  serviceName: string;
  results: DeployResult[];
  error?: string;
}) {
  const prLinks = results
    .filter((r) => r.prUrl)
    .map((r) => ({ stage: r.stage, url: r.prUrl as string }));
  const stages = results.map((r) => r.stage);
  const branch = results.find((r) => r.branch)?.branch ?? null;

  return (
    <Detail
      navigationTitle={`Deploy: ${serviceName}`}
      markdown={buildResultMarkdown(results, error)}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Service" text={serviceName} />
          {branch && <Detail.Metadata.Label title="Branch" text={branch} />}
          <Detail.Metadata.TagList title="Status">
            <Detail.Metadata.TagList.Item
              text={error ? "Failed" : "Success"}
              color={error ? Color.Red : Color.Green}
            />
          </Detail.Metadata.TagList>
          <Detail.Metadata.Separator />
          <Detail.Metadata.TagList title="Stages">
            {stages.map((s) => (
              <Detail.Metadata.TagList.Item key={s} text={s} />
            ))}
          </Detail.Metadata.TagList>
          {prLinks.length > 0 && <Detail.Metadata.Separator />}
          {prLinks.map((pr) => (
            <Detail.Metadata.Link
              key={pr.stage}
              title={pr.stage}
              target={pr.url}
              text="PR"
            />
          ))}
        </Detail.Metadata>
      }
    />
  );
}

export async function executeDeploy(
  service: ServiceInfo,
  target: DeployTarget,
  repoPath: string,
  repoName: string,
  push: (view: React.ReactNode) => void,
  ticket?: string,
) {
  const stages = STAGES_FOR_TARGET[target];
  const toast = await showToast({
    style: Toast.Style.Animated,
    title: `Deploying ${service.name}...`,
  });
  const results: DeployResult[] = [];

  try {
    if (requiresMainBranch(target)) {
      toast.message = "Checking out main...";
      await gitCheckoutMainAndPull(repoPath);
    }

    for (const stage of stages) {
      toast.message = `Deploying to ${stage}...`;
      const result = await deploySingle(service.name, stage, repoPath, ticket);
      results.push(result);
    }

    const slackMessage = buildSlackMessage(service.name, results);
    if (slackMessage) {
      await Clipboard.copy(slackMessage);
      toast.style = Toast.Style.Success;
      toast.title = "Deployed — PR links copied to clipboard";
      toast.message = slackMessage;
    } else {
      toast.style = Toast.Style.Success;
      toast.title = `Deployed ${service.name}`;
      toast.message = stages.join(", ");
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    toast.style = Toast.Style.Failure;
    toast.title = "Deployment failed";
    toast.message = msg;
    await saveDeployToHistory({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      serviceName: service.name,
      repoName,
      target,
      timestamp: Date.now(),
      results,
      error: msg,
    }).catch(() => {});
    push(
      <DeployResultView
        serviceName={service.name}
        results={results}
        error={msg}
      />,
    );
    return;
  }

  await saveDeployToHistory({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    serviceName: service.name,
    repoName,
    target,
    timestamp: Date.now(),
    results,
  }).catch(() => {});
  push(<DeployResultView serviceName={service.name} results={results} />);
}

export function DeployForm({
  repoName,
  service,
}: {
  repoName: string;
  service: ServiceInfo;
}) {
  const prefs = getPreferenceValues<Preferences>();
  const repoPath = join(prefs.projectsDirectory, repoName);
  const { push } = useNavigation();

  const { data: tickets = [] } = usePromise(fetchAssignedTickets);
  const [isDeploying, setIsDeploying] = useState(false);
  const [ticketSource, setTicketSource] = useState("assigned");
  const [manualTicketError, setManualTicketError] = useState<
    string | undefined
  >();

  const MANUAL_ENTRY = "__manual__";
  const isManual = ticketSource === MANUAL_ENTRY;
  const TICKET_PATTERN = /^[A-Za-z]{1,5}-\d{1,6}$/;

  function resolveTicket(values: {
    ticket: string;
    manualTicket?: string;
  }): string | null {
    const raw = isManual ? (values.manualTicket ?? "") : values.ticket;
    const trimmed = raw.trim().toUpperCase();
    if (!trimmed) {
      showToast({ style: Toast.Style.Failure, title: "Ticket is required" });
      return null;
    }
    if (!TICKET_PATTERN.test(trimmed)) {
      showToast({
        style: Toast.Style.Failure,
        title: "Invalid ticket format",
        message: "Expected format: ABC-123",
      });
      return null;
    }
    return trimmed;
  }

  async function handleDeploy(
    target: DeployTarget,
    values: { ticket: string; manualTicket?: string },
  ) {
    const ticket = resolveTicket(values);
    if (!ticket) return;

    setIsDeploying(true);
    try {
      await executeDeploy(service, target, repoPath, repoName, push, ticket);
    } finally {
      setIsDeploying(false);
    }
  }

  function validateManualTicket(value: string | undefined): string | undefined {
    const v = (value ?? "").trim();
    if (!v) return "Ticket is required";
    if (!TICKET_PATTERN.test(v))
      return "Expected format: ABC-123 (up to 5 letters, up to 6 digits)";
    return undefined;
  }

  return (
    <Form
      isLoading={isDeploying}
      navigationTitle={`Deploy ${service.name}`}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Deploy to All Environments"
            onSubmit={(values: { ticket: string; manualTicket?: string }) =>
              handleDeploy("all", values)
            }
          />
          <Action.SubmitForm
            title="Deploy to Sandbox"
            shortcut={{ modifiers: ["cmd"], key: "3" }}
            onSubmit={(values: { ticket: string; manualTicket?: string }) =>
              handleDeploy("sandbox", values)
            }
          />
          <Action.SubmitForm
            title="Deploy to Live"
            shortcut={{ modifiers: ["cmd"], key: "4" }}
            onSubmit={(values: { ticket: string; manualTicket?: string }) =>
              handleDeploy("live", values)
            }
          />
        </ActionPanel>
      }
    >
      <Form.Description
        title="Service"
        text={`${repoName} / ${service.name}`}
      />
      <Form.Separator />
      <Form.Dropdown
        id="ticket"
        title="Linear Ticket"
        onChange={setTicketSource}
      >
        {tickets.map((t: LinearTicket) => (
          <Form.Dropdown.Item
            key={t.id}
            value={t.identifier}
            title={`${t.identifier} — ${t.title}`}
          />
        ))}
        <Form.Dropdown.Item
          key={MANUAL_ENTRY}
          value={MANUAL_ENTRY}
          title="Enter manually…"
        />
      </Form.Dropdown>
      {isManual && (
        <Form.TextField
          id="manualTicket"
          title="Ticket ID"
          placeholder="ENG-123"
          error={manualTicketError}
          onChange={(v) => setManualTicketError(validateManualTicket(v))}
          onBlur={(e) =>
            setManualTicketError(validateManualTicket(e.target.value ?? ""))
          }
        />
      )}
    </Form>
  );
}
