import { List, ActionPanel, Action, Alert, confirmAlert, showToast, Toast, LocalStorage } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { getAllOverrides, OverrideEntry } from "./lib/storage";

export default function ManageOverrides() {
  const { data: overrides = [], isLoading, revalidate } = usePromise(getAllOverrides);

  async function handleDelete(entry: OverrideEntry) {
    if (
      await confirmAlert({
        title: "Delete Override",
        message: `Remove override "${entry.overrideName}" for ${entry.repoName}/${entry.originalName}?`,
        primaryAction: { title: "Delete", style: Alert.ActionStyle.Destructive },
      })
    ) {
      await LocalStorage.removeItem(entry.key);
      await showToast({ style: Toast.Style.Success, title: "Override removed" });
      revalidate();
    }
  }

  return (
    <List isLoading={isLoading}>
      {overrides.length === 0 ? (
        <List.EmptyView title="No Overrides" description="Service name overrides will appear here after you set them." />
      ) : (
        overrides.map((entry) => (
          <List.Item
            key={entry.key}
            title={entry.overrideName}
            subtitle={`${entry.repoName}/${entry.originalName}`}
            accessories={[{ text: entry.repoName }]}
            actions={
              <ActionPanel>
                <Action title="Delete Override" style={Action.Style.Destructive} onAction={() => handleDelete(entry)} />
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}
