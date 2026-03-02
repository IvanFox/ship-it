import {
  List,
  ActionPanel,
  Action,
  Icon,
  Color,
  Clipboard,
  showToast,
  Toast,
} from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { getDeployHistory } from "./lib/storage";
import { DeployResultView } from "./deploy-form";
import { DeployHistoryEntry, hasNoChanges } from "./types";

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

function getPrLinks(entry: DeployHistoryEntry): string[] {
  return entry.results
    .filter((r) => r.prUrl)
    .map((r) => r.prUrl as string);
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
      {history.map((entry) => {
        const prLinks = getPrLinks(entry);
        const noChanges = !entry.error && hasNoChanges(entry.results);
        const statusText = entry.error
          ? "Failed"
          : noChanges
            ? "No Changes"
            : "Success";
        const statusColor = entry.error
          ? Color.Red
          : noChanges
            ? Color.Orange
            : Color.Green;
        const icon = entry.error
          ? Icon.XMarkCircle
          : noChanges
            ? Icon.Minus
            : Icon.CheckCircle;
        return (
          <List.Item
            key={entry.id}
            title={entry.serviceName}
            subtitle={entry.target}
            icon={icon}
            accessories={[
              {
                tag: {
                  value: statusText,
                  color: statusColor,
                },
              },
              ...(prLinks.length > 0
                ? [{ icon: Icon.Link, text: `${prLinks.length} PR${prLinks.length > 1 ? "s" : ""}` }]
                : []),
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
                {prLinks.length > 0 && (
                  <Action
                    title="Copy PR Links"
                    icon={Icon.Link}
                    shortcut={{ modifiers: ["cmd"], key: "c" }}
                    onAction={async () => {
                      await Clipboard.copy(prLinks.join("\n"));
                      await showToast({
                        style: Toast.Style.Success,
                        title: "PR links copied",
                      });
                    }}
                  />
                )}
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}
