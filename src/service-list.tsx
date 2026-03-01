import { List, ActionPanel, Action, Form, Icon, showToast, Toast, getPreferenceValues, useNavigation } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { join } from "path";
import { discoverServices } from "./lib/services";
import { setServiceOverride, removeServiceOverride } from "./lib/storage";
import { Preferences, ServiceInfo } from "./types";
import { DeployForm } from "./deploy-form";

function RenameForm({ repoName, service, onDone }: { repoName: string; service: ServiceInfo; onDone: () => void }) {
  const { pop } = useNavigation();

  async function handleSubmit(values: { name: string }) {
    const trimmed = values.name.trim();
    if (!trimmed) {
      await showToast({ style: Toast.Style.Failure, title: "Name cannot be empty" });
      return;
    }
    await setServiceOverride(repoName, service.originalName, trimmed);
    await showToast({ style: Toast.Style.Success, title: `Renamed to ${trimmed}` });
    onDone();
    pop();
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField id="name" title="Service Name" defaultValue={service.name} />
    </Form>
  );
}

export function ServiceList({ repoName }: { repoName: string }) {
  const prefs = getPreferenceValues<Preferences>();
  const repoPath = join(prefs.projectsDirectory, repoName);

  const { data: services = [], isLoading, revalidate } = usePromise(() => discoverServices(repoPath));

  async function handleResetOverride(service: ServiceInfo) {
    await removeServiceOverride(repoName, service.originalName);
    await showToast({ style: Toast.Style.Success, title: `Reset to ${service.originalName}` });
    revalidate();
  }

  return (
    <List isLoading={isLoading} navigationTitle={repoName} searchBarPlaceholder="Search services...">
      {services.map((svc) => {
        const isOverridden = svc.name !== svc.originalName;
        return (
          <List.Item
            key={svc.originalName}
            title={svc.name}
            subtitle={svc.path}
            accessories={isOverridden ? [{ tag: "overridden" }] : []}
            actions={
              <ActionPanel>
                <Action.Push
                  title="Deploy Service"
                  target={<DeployForm repoName={repoName} service={svc} />}
                />
                <Action.Push
                  title="Rename Service"
                  icon={Icon.Pencil}
                  shortcut={{ modifiers: ["cmd"], key: "e" }}
                  target={<RenameForm repoName={repoName} service={svc} onDone={revalidate} />}
                />
                {isOverridden && (
                  <Action
                    title="Reset to Original Name"
                    icon={Icon.Undo}
                    shortcut={{ modifiers: ["cmd", "shift"], key: "e" }}
                    onAction={() => handleResetOverride(svc)}
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
