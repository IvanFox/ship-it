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

function DeployResultView({
  serviceName,
  results,
  error,
}: {
  serviceName: string;
  results: DeployResult[];
  error?: string;
}) {
  const prUrls = results
    .filter((r) => r.prUrl)
    .map((r) => ({ stage: r.stage, url: r.prUrl as string }));
  const stages = results.map((r) => r.stage);

  return (
    <Detail
      navigationTitle={`Deploy: ${serviceName}`}
      markdown={buildResultMarkdown(results, error)}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Service" text={serviceName} />
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
          {prUrls.length > 0 && <Detail.Metadata.Separator />}
          {prUrls.map((pr) => (
            <Detail.Metadata.Link
              key={pr.url}
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
    push(
      <DeployResultView
        serviceName={service.name}
        results={results}
        error={msg}
      />,
    );
    return;
  }

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

  async function handleDeploy(target: DeployTarget, ticket: string) {
    if (!ticket.trim()) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Ticket is required",
      });
      return;
    }

    setIsDeploying(true);
    try {
      await executeDeploy(service, target, repoPath, push, ticket);
    } finally {
      setIsDeploying(false);
    }
  }

  return (
    <Form
      isLoading={isDeploying}
      navigationTitle={`Deploy ${service.name}`}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Deploy to All Environments"
            onSubmit={(values: { ticket: string }) =>
              handleDeploy("all", values.ticket)
            }
          />
          <Action.SubmitForm
            title="Deploy to Sandbox"
            shortcut={{ modifiers: ["cmd"], key: "3" }}
            onSubmit={(values: { ticket: string }) =>
              handleDeploy("sandbox", values.ticket)
            }
          />
          <Action.SubmitForm
            title="Deploy to Live"
            shortcut={{ modifiers: ["cmd"], key: "4" }}
            onSubmit={(values: { ticket: string }) =>
              handleDeploy("live", values.ticket)
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
      <Form.Dropdown id="ticket" title="Linear Ticket" storeValue>
        {tickets.map((t: LinearTicket) => (
          <Form.Dropdown.Item
            key={t.id}
            value={t.identifier}
            title={`${t.identifier} — ${t.title}`}
          />
        ))}
      </Form.Dropdown>
    </Form>
  );
}
