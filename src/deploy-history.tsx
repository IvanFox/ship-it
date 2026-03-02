import { List, ActionPanel, Action, Icon, Color } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { getDeployHistory } from "./lib/storage";
import { DeployResultView } from "./deploy-form";

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function DeployHistory() {
  const { data: history = [], isLoading } = usePromise(getDeployHistory);

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search deploy history...">
      <List.EmptyView
        icon={Icon.Clock}
        title="No deployments yet"
        description="Deploy a service to see its history here."
      />
      {history.map((entry) => (
        <List.Item
          key={entry.id}
          title={entry.serviceName}
          subtitle={entry.target}
          icon={entry.error ? Icon.XMarkCircle : Icon.CheckCircle}
          accessories={[
            {
              tag: {
                value: entry.error ? "Failed" : "Success",
                color: entry.error ? Color.Red : Color.Green,
              },
            },
            { text: entry.repoName },
            { text: formatRelativeTime(entry.timestamp) },
          ]}
          actions={
            <ActionPanel>
              <Action.Push
                title="View Details"
                target={
                  <DeployResultView
                    serviceName={entry.serviceName}
                    results={entry.results}
                    error={entry.error}
                  />
                }
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
