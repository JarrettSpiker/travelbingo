import { getDeps } from "./context.ts";
import { route, type ApiEvent } from "./router.ts";
import type { JsonResponse } from "./http.ts";

export async function handler(event: ApiEvent): Promise<JsonResponse> {
  return route(getDeps(), event);
}
