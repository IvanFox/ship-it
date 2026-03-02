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
  Icon,
} from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { join } from "path";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAssignedTickets, LinearTicket } from "./lib/linear";
import {
  deploySingle,
  gitCheckoutMainAndPull,
  detectTicketId,
} from "./lib/sdc";
import { buildSlackMessage } from "./lib/slack";
import { saveDeployToHistory } from "./lib/storage";
import {
  DeployResult,
  DeployTarget,
  STAGES_FOR_TARGET,
  requiresMainBranch,
  hasNoChanges,
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
  const noChanges = !error && hasNoChanges(results);

  const statusText = error ? "Failed" : noChanges ? "No Changes" : "Success";
  const statusColor = error
    ? Color.Red
    : noChanges
      ? Color.Orange
      : Color.Green;

  const slackMessage = buildSlackMessage(serviceName, results);

  return (
    <Detail
      navigationTitle={`Deploy: ${serviceName}`}
      markdown={buildResultMarkdown(results, error)}
      actions={
        slackMessage ? (
          <ActionPanel>
            <Action.CopyToClipboard
              title="Copy Slack Message"
              content={slackMessage}
            />
          </ActionPanel>
        ) : undefined
      }
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Service" text={serviceName} />
          {branch && <Detail.Metadata.Label title="Branch" text={branch} />}
          <Detail.Metadata.TagList title="Status">
            <Detail.Metadata.TagList.Item
              text={statusText}
              color={statusColor}
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

export function LiveDeployView({
  serviceName,
  stages,
  repoPath,
  repoName,
  target,
  ticket,
}: {
  serviceName: string;
  stages: readonly string[];
  repoPath: string;
  repoName: string;
  target: DeployTarget;
  ticket?: string;
}) {
  const [results, setResults] = useState<DeployResult[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const didStart = useRef(false);

  const runDeploy = useCallback(async () => {
    const collected: DeployResult[] = [];
    try {
      if (requiresMainBranch(target)) {
        setCurrentStage("git checkout main");
        await gitCheckoutMainAndPull(repoPath);
      }

      for (const stage of stages) {
        setCurrentStage(stage);
        const result = await deploySingle(serviceName, stage, repoPath, ticket);
        collected.push(result);
        setResults([...collected]);
      }

      if (!hasNoChanges(collected)) {
        const slackMessage = buildSlackMessage(serviceName, collected);
        if (slackMessage) {
          await Clipboard.copy(slackMessage);
          await showToast({
            style: Toast.Style.Success,
            title: "Deployed — PR links copied to clipboard",
          });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      await saveDeployToHistory({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        serviceName,
        repoName,
        target,
        timestamp: Date.now(),
        results: collected,
        error: msg,
      }).catch(() => {});
      setCurrentStage(null);
      setDone(true);
      return;
    }

    await saveDeployToHistory({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      serviceName,
      repoName,
      target,
      timestamp: Date.now(),
      results: collected,
    }).catch(() => {});
    setCurrentStage(null);
    setDone(true);
  }, [serviceName, stages, repoPath, repoName, target, ticket]);

  useEffect(() => {
    if (didStart.current) return;
    didStart.current = true;
    runDeploy();
  }, [runDeploy]);

  const isDeploying = !done;
  const completedStages = new Set(results.map((r) => r.stage));
  const noChanges = done && !error && hasNoChanges(results);
  const statusText = !done
    ? "Deploying"
    : error
      ? "Failed"
      : noChanges
        ? "No Changes"
        : "Success";
  const statusColor = !done
    ? Color.Blue
    : error
      ? Color.Red
      : noChanges
        ? Color.Orange
        : Color.Green;

  const prLinks = results
    .filter((r) => r.prUrl)
    .map((r) => ({ stage: r.stage, url: r.prUrl as string }));
  const branch = results.find((r) => r.branch)?.branch ?? null;
  const slackMessage = done ? buildSlackMessage(serviceName, results) : null;

  return (
    <Detail
      isLoading={isDeploying}
      navigationTitle={`Deploy: ${serviceName}`}
      markdown={buildResultMarkdown(results, error)}
      actions={
        slackMessage ? (
          <ActionPanel>
            <Action.CopyToClipboard
              title="Copy Slack Message"
              content={slackMessage}
            />
          </ActionPanel>
        ) : undefined
      }
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Service" text={serviceName} />
          {branch && <Detail.Metadata.Label title="Branch" text={branch} />}
          <Detail.Metadata.TagList title="Status">
            <Detail.Metadata.TagList.Item
              text={statusText}
              color={statusColor}
            />
          </Detail.Metadata.TagList>
          <Detail.Metadata.Separator />
          <Detail.Metadata.TagList title="Stages">
            {stages.map((s) => (
              <Detail.Metadata.TagList.Item
                key={s}
                text={s}
                color={
                  completedStages.has(s)
                    ? error &&
                      s === results[results.length - 1]?.stage &&
                      results.length < stages.length
                      ? Color.Red
                      : Color.Green
                    : s === currentStage
                      ? Color.Blue
                      : Color.SecondaryText
                }
                icon={
                  completedStages.has(s)
                    ? Icon.Checkmark
                    : s === currentStage
                      ? Icon.Clock
                      : undefined
                }
              />
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
  const { data: detectedTicket } = usePromise(() => detectTicketId(repoPath));
  const [ticketSource, setTicketSource] = useState("assigned");
  const [manualTicketError, setManualTicketError] = useState<
    string | undefined
  >();
  const [didAutoSelect, setDidAutoSelect] = useState(false);

  const MANUAL_ENTRY = "__manual__";
  const isManual = ticketSource === MANUAL_ENTRY;
  const TICKET_PATTERN = /^[A-Za-z]{1,5}-\d{1,6}$/;

  // Auto-select detected ticket once both tickets list and detection resolve
  useEffect(() => {
    if (didAutoSelect || !detectedTicket || tickets.length === 0) return;
    const match = tickets.find((t) => t.identifier === detectedTicket);
    if (match) {
      setTicketSource(match.identifier);
    } else {
      setTicketSource(MANUAL_ENTRY);
    }
    setDidAutoSelect(true);
  }, [tickets, detectedTicket, didAutoSelect]);

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

  function handleDeploy(
    target: DeployTarget,
    values: { ticket: string; manualTicket?: string },
  ) {
    const ticket = resolveTicket(values);
    if (!ticket) return;

    const stages = STAGES_FOR_TARGET[target];
    push(
      <LiveDeployView
        serviceName={service.name}
        stages={stages}
        repoPath={repoPath}
        repoName={repoName}
        target={target}
        ticket={ticket}
      />,
    );
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
        value={ticketSource}
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
          defaultValue={isManual && detectedTicket ? detectedTicket : undefined}
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
