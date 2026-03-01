import { Form, ActionPanel, Action, showToast, Toast, Clipboard, getPreferenceValues } from "@raycast/api";
import { withAccessToken, usePromise } from "@raycast/utils";
import { useState, useEffect } from "react";
import { join } from "path";
import { linearOAuth, fetchAssignedTickets, LinearTicket } from "./lib/linear";
import { listRepositories, discoverServices } from "./lib/services";
import { deploySingle, gitCheckoutMainAndPull } from "./lib/sdc";
import { setServiceOverride } from "./lib/storage";
import { buildSlackMessage } from "./lib/slack";
import { DeployTarget, STAGES_FOR_TARGET, requiresMainBranch, ServiceInfo, Preferences } from "./types";

function DeployForm() {
  const prefs = getPreferenceValues<Preferences>();
  const repos = listRepositories(prefs.projectsDirectory);

  const [selectedRepo, setSelectedRepo] = useState<string>(repos[0] ?? "");
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [selectedService, setSelectedService] = useState<string>("");
  const [isDeploying, setIsDeploying] = useState(false);

  const { data: tickets = [] } = usePromise(fetchAssignedTickets);

  useEffect(() => {
    if (!selectedRepo) {
      setServices([]);
      return;
    }
    const repoPath = join(prefs.projectsDirectory, selectedRepo);
    discoverServices(repoPath).then((discovered) => {
      setServices(discovered);
      setSelectedService(discovered[0]?.name ?? "");
    });
  }, [selectedRepo]);

  async function handleSubmit(values: { repo: string; service: string; ticket: string; target: DeployTarget }) {
    if (!values.ticket.trim()) {
      await showToast({ style: Toast.Style.Failure, title: "Ticket is required" });
      return;
    }

    setIsDeploying(true);
    const repoPath = join(prefs.projectsDirectory, values.repo);
    const stages = STAGES_FOR_TARGET[values.target];

    const toast = await showToast({ style: Toast.Style.Animated, title: `Deploying ${values.service}...` });

    try {
      // Save override if the user changed the service name
      const matchingService = services.find((s) => s.name === values.service);
      if (matchingService && matchingService.name !== matchingService.originalName) {
        await setServiceOverride(values.repo, matchingService.originalName, matchingService.name);
      }

      // Git checkout main if needed
      if (requiresMainBranch(values.target)) {
        toast.message = "Checking out main...";
        await gitCheckoutMainAndPull(repoPath);
      }

      // Deploy to each stage
      const results = [];
      for (const stage of stages) {
        toast.message = `Deploying to ${stage}...`;
        const result = await deploySingle(values.service, stage, values.ticket, repoPath);
        results.push(result);
      }

      // Build and copy Slack message if applicable
      const slackMessage = buildSlackMessage(results);
      if (slackMessage) {
        await Clipboard.copy(slackMessage);
        toast.style = Toast.Style.Success;
        toast.title = "Deployed — PR links copied to clipboard";
        toast.message = slackMessage;
      } else {
        toast.style = Toast.Style.Success;
        toast.title = `Deployed ${values.service}`;
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
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Deploy" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Dropdown id="repo" title="Repository" value={selectedRepo} onChange={setSelectedRepo}>
        {repos.map((repo) => (
          <Form.Dropdown.Item key={repo} value={repo} title={repo} />
        ))}
      </Form.Dropdown>

      <Form.Dropdown id="service" title="Service" value={selectedService} onChange={setSelectedService}>
        {services.map((svc) => (
          <Form.Dropdown.Item
            key={svc.originalName}
            value={svc.name}
            title={svc.name !== svc.originalName ? `${svc.name} (override of ${svc.originalName})` : svc.name}
          />
        ))}
      </Form.Dropdown>

      <Form.Dropdown id="ticket" title="Linear Ticket" storeValue>
        {tickets.map((t: LinearTicket) => (
          <Form.Dropdown.Item key={t.id} value={t.identifier} title={`${t.identifier} — ${t.title}`} />
        ))}
      </Form.Dropdown>

      <Form.Dropdown id="target" title="Deploy Target" defaultValue="all">
        <Form.Dropdown.Item value="unstable" title="Unstable" />
        <Form.Dropdown.Item value="staging" title="Staging" />
        <Form.Dropdown.Item value="sandbox" title="Sandbox" />
        <Form.Dropdown.Item value="live" title="Live" />
        <Form.Dropdown.Item value="all" title="All Environments" />
      </Form.Dropdown>
    </Form>
  );
}

export default withAccessToken(linearOAuth)(DeployForm);
