// The only module that talks to the API. Both the token source and fetch are
// injected, so every branch here — including the 401 refresh retry — is tested
// without a network or a mocking library.

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message?: string) {
    super(message ?? code);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }

  /** True when the resource is absent *or* not ours — the server does not distinguish. */
  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isUnauthenticated(): boolean {
    return this.status === 401;
  }
}

export interface ApiClientDeps {
  /** Returns a usable access token, refreshing if needed. Null when signed out. */
  getAccessToken: () => Promise<string | null>;
  /** Forces a refresh, used once after a 401. Returns null if it fails. */
  refreshAccessToken: () => Promise<string | null>;
  fetch: typeof fetch;
  baseUrl?: string;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Set for the share-resolution route, which needs no account. */
  anonymous?: boolean;
}

async function readError(response: Response): Promise<ApiError> {
  let code = "error";
  let message: string | undefined;

  try {
    const body = (await response.json()) as Record<string, unknown>;
    if (typeof body.error === "string") code = body.error;
    if (typeof body.message === "string") message = body.message;
  } catch {
    // A non-JSON error body means something upstream answered instead of the
    // API. Falling through to the status code is the honest reading of it.
  }

  return new ApiError(response.status, code, message);
}

export function createApiClient(deps: ApiClientDeps) {
  const baseUrl = deps.baseUrl ?? "";

  async function send(path: string, options: RequestOptions, token: string | null): Promise<Response> {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (options.body !== undefined) headers["Content-Type"] = "application/json";

    return deps.fetch(`${baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      // These are per-user documents; never let a cache hold one.
      cache: "no-store",
      credentials: "omit",
    });
  }

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const token = options.anonymous ? null : await deps.getAccessToken();

    if (!options.anonymous && !token) {
      throw new ApiError(401, "unauthorized");
    }

    let response = await send(path, options, token);

    // One retry, and only one: a 401 usually means the access token expired
    // between the expiry check and the request landing. If a fresh token is
    // also rejected, the session is genuinely gone and looping would not help.
    if (response.status === 401 && !options.anonymous) {
      const refreshed = await deps.refreshAccessToken();
      if (refreshed) {
        response = await send(path, options, refreshed);
      }
    }

    if (!response.ok) {
      throw await readError(response);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  return { request };
}

export type ApiClient = ReturnType<typeof createApiClient>;
