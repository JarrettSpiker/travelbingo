import { BatchGetCommand } from "@aws-sdk/lib-dynamodb";
import type { Deps } from "../context.ts";
import { profileKey } from "./keys.ts";

/**
 * Fetches the display name for each given user id in one BatchGet. Profiles are
 * written lazily, so an absent item (no name set) maps to null rather than
 * missing the user. Used to surface member names in a trip and actor names on
 * events and notifications without storing them there — which is exactly why a
 * rename never leaves stale names behind.
 */
export async function fetchDisplayNames(
  deps: Deps,
  userIds: string[],
): Promise<Map<string, string | null>> {
  const names = new Map<string, string | null>();
  if (userIds.length === 0) return names;

  const result = await deps.ddb.send(
    new BatchGetCommand({
      RequestItems: { [deps.tableName]: { Keys: userIds.map((uid) => profileKey(uid)) } },
    }),
  );

  for (const item of (result.Responses?.[deps.tableName] ?? []) as { PK: string; displayName?: string }[]) {
    // PK is USER#<sub>; recover the id it was fetched by.
    const sub = String(item.PK).startsWith("USER#") ? String(item.PK).slice("USER#".length) : null;
    if (sub !== null) names.set(sub, item.displayName ?? null);
  }
  return names;
}
