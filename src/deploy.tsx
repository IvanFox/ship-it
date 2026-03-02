import {
  List,
  ActionPanel,
  Action,
  Icon,
  Color,
  getPreferenceValues,
  showToast,
  Toast,
} from "@raycast/api";
import { withAccessToken, usePromise } from "@raycast/utils";
import { join } from "path";
import { linearOAuth } from "./lib/linear";
import { listRepositories, discoverServices } from "./lib/services";
import { getPinnedRepos, togglePinRepo } from "./lib/storage";
import { Preferences } from "./types";
import { ServiceList } from "./service-list";
import DeployHistory from "./deploy-history";

function RepoList() {
  const prefs = getPreferenceValues<Preferences>();
  const repos = listRepositories(prefs.projectsDirectory);

  const { data: pinnedRepos = [], revalidate } = usePromise(getPinnedRepos);
  const { data: serviceCounts = {} } = usePromise(async () => {
    const counts: Record<string, number> = {};
    for (const repo of repos) {
      const services = await discoverServices(
        join(prefs.projectsDirectory, repo),
      );
      counts[repo] = services.length;
    }
    return counts;
  });

  const pinned = repos.filter((r) => pinnedRepos.includes(r));
  const unpinned = repos.filter((r) => !pinnedRepos.includes(r));

  async function handleTogglePin(repo: string) {
    const isPinned = await togglePinRepo(repo);
    await showToast({
      style: Toast.Style.Success,
      title: isPinned ? `Pinned ${repo}` : `Unpinned ${repo}`,
    });
    revalidate();
  }

  function repoAccessories(repo: string) {
    const count = serviceCounts[repo];
    if (count === undefined) return [];
    return [{ text: `${count} ${count === 1 ? "service" : "services"}` }];
  }

  return (
    <List searchBarPlaceholder="Search repositories...">
      {pinned.length > 0 && (
        <List.Section title="Pinned">
          {pinned.map((repo) => (
            <List.Item
              key={repo}
              title={repo}
              icon={{ source: Icon.Star, tintColor: Color.Yellow }}
              accessories={repoAccessories(repo)}
              actions={
                <ActionPanel>
                  <Action.Push
                    title="Select Repository"
                    target={<ServiceList repoName={repo} />}
                  />
                  <Action
                    title="Unpin Repository"
                    icon={Icon.StarDisabled}
                    shortcut={{ modifiers: ["cmd"], key: "d" }}
                    onAction={() => handleTogglePin(repo)}
                  />
                  <Action.Push
                    title="Deploy History"
                    icon={Icon.Clock}
                    shortcut={{ modifiers: ["cmd"], key: "h" }}
                    target={<DeployHistory />}
                  />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      )}
      <List.Section title="All Repositories">
        {unpinned.map((repo) => (
          <List.Item
            key={repo}
            title={repo}
            icon={Icon.Folder}
            accessories={repoAccessories(repo)}
            actions={
              <ActionPanel>
                <Action.Push
                  title="Select Repository"
                  target={<ServiceList repoName={repo} />}
                />
                <Action
                  title="Pin Repository"
                  icon={Icon.Star}
                  shortcut={{ modifiers: ["cmd"], key: "d" }}
                  onAction={() => handleTogglePin(repo)}
                />
                <Action.Push
                  title="Deploy History"
                  icon={Icon.Clock}
                  shortcut={{ modifiers: ["cmd"], key: "h" }}
                  target={<DeployHistory />}
                />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
      <List.EmptyView
        icon={Icon.Folder}
        title="No repositories found"
        description="Check your Projects Directory in extension preferences."
      />
    </List>
  );
}

export default withAccessToken(linearOAuth)(RepoList);
