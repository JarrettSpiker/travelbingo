import { beforeEach, describe, expect, it } from "vitest";
import { HttpError } from "../http.ts";
import { FEEDBACK_SK_PREFIX, feedbackPartition, userFeedbackPointerKey, userPartition } from "../lib/keys.ts";
import { makeTestDeps, type TestDeps } from "../testing/fakeDdb.ts";
import type { RouteRequest } from "../request.ts";
import {
  createFeedback,
  datePartitionFor,
  FEEDBACK_CAP_CODE,
  FEEDBACK_RETENTION_DAYS,
  MAX_FEEDBACK_PER_WINDOW,
} from "./feedback.ts";

const NOW = "2026-08-02T00:00:00.000Z";

const BODY = {
  message: "The print layout cuts off the last row on A4.",
  context: { brand: "office", environment: "dev", route: "/cards/abc", buildSha: "abc123" },
};

function request(overrides: Partial<RouteRequest> = {}): RouteRequest {
  return { userId: "user-a", params: {}, body: BODY, ...overrides };
}

function errorOf(promise: Promise<unknown>): Promise<HttpError> {
  return promise.then(
    () => {
      throw new Error("expected the call to reject");
    },
    (error: unknown) => {
      if (error instanceof HttpError) return error;
      throw error;
    },
  );
}

/** Every item the fake holds in the day's feedback partition. */
function submissions(deps: TestDeps, date = datePartitionFor(NOW)) {
  return [...deps.ddb.items.values()].filter((item) => item.PK === feedbackPartition(date));
}

function pointers(deps: TestDeps, userId = "user-a") {
  return [...deps.ddb.items.values()].filter(
    (item) => item.PK === userPartition(userId) && String(item.SK).startsWith(FEEDBACK_SK_PREFIX),
  );
}

describe("createFeedback", () => {
  let deps: TestDeps;
  beforeEach(() => {
    deps = makeTestDeps();
  });

  it("rejects a caller with no verified identity", async () => {
    const error = await errorOf(createFeedback(deps, request({ userId: undefined })));
    expect(error.statusCode).toBe(401);
    expect(deps.ddb.items.size).toBe(0);
  });

  it("stores the submission and its cap pointer together", async () => {
    const response = await createFeedback(deps, request());
    expect(response.statusCode).toBe(201);

    const stored = submissions(deps);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      message: BODY.message,
      submitterId: "user-a",
      createdAt: NOW,
      context: BODY.context,
    });

    expect(pointers(deps)).toHaveLength(1);
  });

  it("gives both records the same expiry", async () => {
    await createFeedback(deps, request());
    const expected = Math.floor((Date.parse(NOW) + FEEDBACK_RETENTION_DAYS * 86_400_000) / 1000);
    expect(submissions(deps)[0]?.expiresAt).toBe(expected);
    expect(pointers(deps)[0]?.expiresAt).toBe(expected);
  });

  it("partitions the submission by the UTC date it was made", async () => {
    await createFeedback(deps, request());
    expect(submissions(deps, "2026-08-02")).toHaveLength(1);
  });

  it("stores no contact attribute when none was given", async () => {
    await createFeedback(deps, request());
    expect("contact" in (submissions(deps)[0] ?? {})).toBe(false);
  });

  it("stores a contact when one was given", async () => {
    await createFeedback(deps, request({ body: { ...BODY, contact: "someone@example.com" } }));
    expect(submissions(deps)[0]?.contact).toBe("someone@example.com");
  });

  // The pointer exists only to make the cap query cheap. If it ever carried the
  // message, the cap check would be reading what people wrote.
  it("keeps the message out of the cap pointer", async () => {
    await createFeedback(deps, request());
    const pointer = pointers(deps)[0] ?? {};
    expect("message" in pointer).toBe(false);
    expect("contact" in pointer).toBe(false);
    expect("context" in pointer).toBe(false);
    expect(JSON.stringify(pointer)).not.toContain("A4");
  });

  it("rejects an invalid payload before writing anything", async () => {
    const error = await errorOf(createFeedback(deps, request({ body: { message: "" } })));
    expect(error.statusCode).toBe(400);
    expect(deps.ddb.items.size).toBe(0);
  });

  it("never stores card content, even when the client sends it in the context", async () => {
    await createFeedback(
      deps,
      request({ body: { ...BODY, context: { ...BODY.context, title: "My secret card" } } }),
    );
    expect(JSON.stringify(submissions(deps)[0])).not.toContain("secret");
  });

  describe("the per-account cap", () => {
    /** Seeds `count` pointers inside the window, as prior submissions would. */
    function seedPointers(userId: string, count: number, at = "2026-08-01T12:00:00.000Z") {
      for (let i = 0; i < count; i += 1) {
        deps.ddb.seed({
          ...userFeedbackPointerKey(userId, `${at}#seed${i}`),
          createdAt: at,
          expiresAt: 0,
        });
      }
    }

    it("accepts the submission that reaches the cap exactly", async () => {
      seedPointers("user-a", MAX_FEEDBACK_PER_WINDOW - 1);
      expect((await createFeedback(deps, request())).statusCode).toBe(201);
      expect(pointers(deps)).toHaveLength(MAX_FEEDBACK_PER_WINDOW);
    });

    it("rejects the one after it with 429 and a distinguishable code", async () => {
      seedPointers("user-a", MAX_FEEDBACK_PER_WINDOW);
      const error = await errorOf(createFeedback(deps, request()));
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe(FEEDBACK_CAP_CODE);
    });

    it("leaves the already-stored submissions intact when it rejects", async () => {
      seedPointers("user-a", MAX_FEEDBACK_PER_WINDOW);
      await errorOf(createFeedback(deps, request()));
      expect(pointers(deps)).toHaveLength(MAX_FEEDBACK_PER_WINDOW);
    });

    // The window is a key range, not a filter — submissions that have aged out
    // must not count, or the cap would become permanent.
    it("ignores pointers older than the window", async () => {
      seedPointers("user-a", MAX_FEEDBACK_PER_WINDOW, "2026-07-01T00:00:00.000Z");
      expect((await createFeedback(deps, request())).statusCode).toBe(201);
    });

    it("counts only the caller's own submissions", async () => {
      seedPointers("user-b", MAX_FEEDBACK_PER_WINDOW);
      expect((await createFeedback(deps, request())).statusCode).toBe(201);
    });

    it("counts a submission made in the same millisecond as the boundary", async () => {
      seedPointers("user-a", MAX_FEEDBACK_PER_WINDOW, NOW);
      const error = await errorOf(createFeedback(deps, request()));
      expect(error.statusCode).toBe(429);
    });
  });
});
