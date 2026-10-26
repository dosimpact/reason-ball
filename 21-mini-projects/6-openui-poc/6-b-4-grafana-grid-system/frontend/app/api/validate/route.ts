import {
  artifactIdsFromRoot,
  sourcesFromRoot,
  blockingProgramErrors,
  stateDefaultErrors,
  componentPlacementErrors,
} from "@/entities/dashboard";
import { createParser } from "@openuidev/lang-core";
import spec from "@/shared/ui/openui/generated/spec.json";
const parser = createParser(spec.schema, spec.root);
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (
    typeof body?.program !== "string" ||
    body.program.length > 120000 ||
    (body.allow_artifacts !== true &&
      body.program.includes("DashboardArtifact("))
  )
    return Response.json(
      { valid: false, error: "Expected an independent panel program" },
      { status: 400 },
    );
  const result = parser.parse(body.program);
  const errors = blockingProgramErrors(result.meta.errors);
  const stateErrors = [
    ...stateDefaultErrors(result.stateDeclarations),
    ...componentPlacementErrors(result.root, spec.schema),
  ];
  const valid =
    !stateErrors.length &&
    !!result.root &&
    !result.meta.incomplete &&
    !result.meta.unresolved.length &&
    !errors.length;
  return Response.json({
    valid,
    sources: valid ? sourcesFromRoot(result.root) : [],
    artifact_ids: artifactIdsFromRoot(result.root),
    errors: [...errors.map((e) => e.message), ...stateErrors],
    unresolved: result.meta.unresolved,
  });
}
