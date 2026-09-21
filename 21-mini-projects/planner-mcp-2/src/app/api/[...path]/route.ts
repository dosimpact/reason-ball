import { z } from "zod";
import { getStore } from "@/app/server/runtime";
import {
  assertAllowedRequest,
  httpError,
  requestJson,
} from "@/app/server/http";
import { DomainError } from "@/entities/planner/rules";
import {
  body,
  checkInput,
  templateInput,
  workflowRules,
} from "@/entities/planner/model";
import { getCodeWeave, updateCodeWeaveNode } from "@/app/server/codeweave";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const revision = z.number().int().positive();
const revisionOnly = z.object({ expectedRevision: revision }).strict();
async function handler(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    assertAllowedRequest(request);
    const path = (await context.params).path;
    const [resource, id, sub, item, action] = path;
    const method = request.method;
    const store = getStore();
    const url = new URL(request.url);
    const input = method === "GET" ? undefined : await requestJson(request);
    let result: unknown;
    if (resource === "workflow" && path.length === 1 && method === "GET")
      result = workflowRules;
    else if (resource === "projects") {
      if (path.length === 1 && method === "GET") result = store.listProjects();
      else if (path.length === 1 && method === "POST")
        result = store.createProject(input);
      else if (path.length === 2 && method === "GET")
        result = store.getProject(id);
      else if (path.length === 2 && method === "PATCH")
        result = store.updateProject(id, input);
      else if (path.length === 2 && method === "DELETE")
        result = store.deleteProject(id);
      else if (sub === "nodes" && path.length === 3 && method === "GET")
        result = store.listNodes(id);
      else if (sub === "nodes" && path.length === 3 && method === "POST")
        result = store.createNode(id, input);
      else if (sub === "nodes" && path.length === 4 && method === "PATCH")
        result = store.updateNode(id, item, input);
      else if (sub === "nodes" && path.length === 4 && method === "DELETE")
        result = store.deleteNode(id, item);
    } else if (resource === "templates") {
      if (path.length === 1 && method === "GET") result = store.listTemplates();
      else if (path.length === 1 && method === "POST")
        result = store.saveTemplate(input);
      else if (path.length === 2 && method === "GET")
        result = store.getTemplate(id);
      else if (path.length === 2 && method === "PATCH") {
        const data = templateInput
          .extend({ expectedRevision: revision })
          .strict()
          .parse(input);
        if (data.name !== id)
          throw new DomainError(400, "Template name is immutable");
        const { expectedRevision, ...template } = data;
        result = store.saveTemplate(template, expectedRevision);
      } else if (path.length === 2 && method === "DELETE")
        result = store.deleteTemplate(id);
    } else if (resource === "documents") {
      if (path.length === 1 && method === "GET")
        result = store.listDocuments(
          z.string().min(1).parse(url.searchParams.get("projectId")),
          url.searchParams.get("parentId") ?? undefined,
        );
      else if (path.length === 1 && method === "POST")
        result = store.createDocument(input);
      else if (path.length === 2 && method === "GET")
        result = store.getDocument(id);
      else if (path.length === 2 && method === "PATCH")
        result = store.updateDocument(id, input);
      else if (path.length === 2 && method === "DELETE")
        result = store.deleteDocument(
          id,
          revisionOnly.parse(input).expectedRevision,
        );
      else if (sub === "codeweave" && path.length === 4 && method === "GET")
        result = getCodeWeave(store, id, item, {
          line: url.searchParams.has("line")
            ? Number(url.searchParams.get("line"))
            : undefined,
          query: url.searchParams.get("query") ?? undefined,
        });
      else if (sub === "codeweave" && path.length === 4 && method === "PATCH")
        result = updateCodeWeaveNode(store, id, item, input);
      else if (sub === "checklist" && path.length === 3 && method === "POST") {
        const { expectedRevision, ...data } = checkInput
          .extend({ expectedRevision: revision })
          .strict()
          .parse(input);
        result = store.addCheck(id, data, expectedRevision);
      } else if (sub === "checklist" && path.length === 4 && method === "PATCH")
        result = store.updateCheck(id, item, input);
      else if (sub === "checklist" && path.length === 4 && method === "DELETE")
        result = store.deleteCheck(
          id,
          item,
          revisionOnly.parse(input).expectedRevision,
        );
      else if (
        sub === "checklist" &&
        path.length === 5 &&
        action === "confirm" &&
        method === "POST"
      ) {
        const data = z
          .object({ confirmed: z.boolean(), expectedRevision: revision })
          .strict()
          .parse(input);
        result = store.confirmCheck(
          id,
          item,
          data.confirmed,
          data.expectedRevision,
        );
      } else if (sub === "reopen" && path.length === 3 && method === "POST")
        result = store.reopen(id, input);
      else if (
        sub === "verification" &&
        path.length === 3 &&
        method === "POST"
      ) {
        const data = z
          .object({ body, expectedRevision: revision })
          .strict()
          .parse(input);
        result = store.recordVerification(id, data.body, data.expectedRevision);
      }
    }
    if (result === undefined) throw new DomainError(404, "Endpoint not found");
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return httpError(error);
  }
}
export { handler as GET, handler as POST, handler as PATCH, handler as DELETE };
