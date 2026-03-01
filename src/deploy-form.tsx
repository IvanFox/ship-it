import { Form, ActionPanel, Action, showToast, Toast, Clipboard, getPreferenceValues } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { join } from "path";
import { useState } from "react";
import { fetchAssignedTickets, LinearTicket } from "./lib/linear";
import { deploySingle, gitCheckoutMainAndPull } from "./lib/sdc";
import { buildSlackMessage } from "./lib/slack";
import { DeployTarget, STAGES_FOR_TARGET, requiresMainBranch, ServiceInfo, Preferences } from "./types";

export function DeployForm({ repoName, service }: { repoName: string; service: ServiceInfo }) {
  const prefs = getPreferenceValues<Preferences>();
  const repoPath = join(prefs.projectsDirectory, repoName);

  const { data: tickets = [] } = usePromise(fetchAssignedTickets);
  const [isDeploying, setIsDeploying] = useState(false);

  async function handleDeploy(target: DeployTarget, ticket: string) {
    if (!ticket.trim()) {
      await showToast({ style: Toast.Style.Failure, title: "Ticket is required" });
      return;
    }

    setIsDeploying(true);
    const stages = STAGES_FOR_TARGET[target];
    const toast = await showToast({ style: Toast.Style.Animated, title: `Deploying ${service.name}...` });

    try {
      if (requiresMainBranch(target)) {
        toast.message = "Checking out main...";
        await gitCheckoutMainAndPull(repoPath);
      }

      const results = [];
      for (const stage of stages) {
        toast.message = `Deploying to ${stage}...`;
        const result = await deploySingle(service.name, stage, ticket, repoPath);
        results.push(result);
      }

      const slackMessage = buildSlackMessage(results);
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
      toast.style = Toast.Style.Failure;
      toast.title = "Deployment failed";
      toast.message = error instanceof Error ? error.message : String(error);
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
            onSubmit={(values: { ticket: string }) => handleDeploy("all", values.ticket)}
          />
          <Action.SubmitForm
            title="Deploy to Unstable"
            shortcut={{ modifiers: ["cmd"], key: "1" }}
            onSubmit={(values: { ticket: string }) => handleDeploy("unstable", values.ticket)}
          />
          <Action.SubmitForm
            title="Deploy to Staging"
            shortcut={{ modifiers: ["cmd"], key: "2" }}
            onSubmit={(values: { ticket: string }) => handleDeploy("staging", values.ticket)}
          />
          <Action.SubmitForm
            title="Deploy to Sandbox"
            shortcut={{ modifiers: ["cmd"], key: "3" }}
            onSubmit={(values: { ticket: string }) => handleDeploy("sandbox", values.ticket)}
          />
          <Action.SubmitForm
            title="Deploy to Live"
            shortcut={{ modifiers: ["cmd"], key: "4" }}
            onSubmit={(values: { ticket: string }) => handleDeploy("live", values.ticket)}
          />
        </ActionPanel>
      }
    >
      <Form.Dropdown id="ticket" title="Linear Ticket" storeValue>
        {tickets.map((t: LinearTicket) => (
          <Form.Dropdown.Item key={t.id} value={t.identifier} title={`${t.identifier} — ${t.title}`} />
        ))}
      </Form.Dropdown>
    </Form>
  );
}
