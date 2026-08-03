/** What a route handler receives. Assembled by the router from the event. */
export interface RouteRequest {
  /**
   * The verified caller, or null on the one public route. Established only by
   * getUserId from the JWT claims the authorizer validated — never from the
   * request itself.
   */
  userId: string | null;
  params: Record<string, string>;
  body: unknown;
}
