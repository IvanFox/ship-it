import { List, ActionPanel, Action, Icon, getPreferenceValues, showToast, Toast } from "@raycast/api";
import { withAccessToken, usePromise } from "@raycast/utils";
import { linearOAuth } from "./lib/linear";
import { listRepositories } from "./lib/services";
import { getPinnedRepos, togglePinRepo } from "./lib/storage";
import { Preferences } from "./types";
import { ServiceList } from "./service-list";

function RepoList() {
  const prefs = getPreferenceValues<Preferences>();
  const repos = listRepositories(prefs.projectsDirectory);

  const { data: pinnedRepos = [], revalidate } = usePromise(getPinnedRepos);

  const pinned = repos.filter((r) => pinnedRepos.includes(r));
  const unpinned = repos.filter((r) => !pinnedRepos.includes(r));

  async function handleTogglePin(repo: string) {
    const isPinned = await togglePinRepo(repo);
    await showToast({ style: Toast.Style.Success, title: isPinned ? `Pinned ${repo}` : `Unpinned ${repo}` });
    revalidate();
  }

  return (
    <List searchBarPlaceholder="Search repositories...">
      {pinned.length > 0 && (
        <List.Section title="Pinned">
          {pinned.map((repo) => (
            <List.Item
              key={repo}
              title={repo}
              icon={Icon.Star}
              actions={
                <ActionPanel>
                  <Action.Push title="Select Repository" target={<ServiceList repoName={repo} />} />
                  <Action
                    title="Unpin Repository"
                    icon={Icon.StarDisabled}
                    shortcut={{ modifiers: ["cmd"], key: "d" }}
                    onAction={() => handleTogglePin(repo)}
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
            actions={
              <ActionPanel>
                <Action.Push title="Select Repository" target={<ServiceList repoName={repo} />} />
                <Action
                  title="Pin Repository"
                  icon={Icon.Star}
                  shortcut={{ modifiers: ["cmd"], key: "d" }}
                  onAction={() => handleTogglePin(repo)}
                />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  );
}

export default withAccessToken(linearOAuth)(RepoList);
