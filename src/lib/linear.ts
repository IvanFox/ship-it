import { OAuthService, getAccessToken } from "@raycast/utils";
import { LinearClient, LinearDocument } from "@linear/sdk";

export const linearOAuth = OAuthService.linear({ scope: "read" });

let cachedClient: LinearClient | null = null;

function getClient(): LinearClient {
  if (!cachedClient) {
    const { token } = getAccessToken();
    cachedClient = new LinearClient({ accessToken: token });
  }
  return cachedClient;
}

export interface LinearTicket {
  id: string;
  identifier: string;
  title: string;
}

export async function fetchAssignedTickets(): Promise<LinearTicket[]> {
  try {
    const client = getClient();
    const me = await client.viewer;
    const issues = await me.assignedIssues({
      first: 50,
      orderBy: LinearDocument.PaginationOrderBy.UpdatedAt,
      filter: { state: { type: { nin: ["completed", "canceled"] } } },
    });

    return issues.nodes.map((issue) => ({
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
    }));
  } catch {
    return [];
  }
}
