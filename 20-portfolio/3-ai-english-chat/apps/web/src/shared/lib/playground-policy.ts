type PlaygroundEnvironment = {
  NODE_ENV?: string;
  APP_RUNTIME_MODE?: string;
};

// Both server production signals close the playground, even if public flags
// or mock-provider configuration disagree.
export function isPlaygroundEnabled(environment: PlaygroundEnvironment): boolean {
  return environment.NODE_ENV?.trim() !== "production"
    && environment.APP_RUNTIME_MODE?.trim() !== "production";
}

export function playgroundUnavailableResponse(environment: PlaygroundEnvironment): Response | undefined {
  if (isPlaygroundEnabled(environment)) return undefined;
  return Response.json({ error: { code: "NOT_FOUND", message: "Not found." } }, {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}
