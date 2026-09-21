import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  id,
  title,
  body,
  documentInput,
  documentPatch,
  checkInput,
  checkPatch,
  reopenInput,
  nodeInput,
  workflowRules,
} from "@/entities/planner/model";
import { DomainError } from "@/entities/planner/rules";
import type { PlannerStore } from "./store";
import { getCodeWeave, updateCodeWeaveNode } from "./codeweave";
import {
  codeWeaveQuery,
  codeWeaveNodeEdit,
} from "@/entities/planner/codeweave";
export function createMcpServer(store: PlannerStore) {
  const server = new McpServer(
    { name: "planner-mcp-2", version: "1.0.0" },
    {
      instructions:
        "먼저 get_workflow_rules를 읽고 list_projects → get_project → 단계 index의 get_document로 설계를 탐색하세요. 설계된 범위만 구현하고 항목별 AI 결과 및 record_verification을 갱신하세요. 변경에는 최신 expectedRevision이 필요합니다. 사람 확인은 UI에서만 완료합니다.",
    },
  );
  function tool<S extends z.ZodRawShape>(
    name: string,
    description: string,
    shape: S,
    run: (args: z.infer<z.ZodObject<S>>) => unknown,
  ) {
    const schema = z.object(shape).strict();
    server.registerTool<z.ZodRawShape, typeof schema>(
      name,
      { description, inputSchema: schema },
      async (args) => {
        try {
          const data = run(schema.parse(args));
          return {
            content: [{ type: "text" as const, text: JSON.stringify(data) }],
          };
        } catch (error) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error:
                    error instanceof Error ? error.message : "Unknown error",
                  status: error instanceof DomainError ? error.status : 400,
                }),
              },
            ],
          };
        }
      },
    );
  }
  const expectedRevision = z.number().int().positive();
  tool(
    "get_workflow_rules",
    "Read workflow rules before implementation",
    {},
    () => workflowRules,
  );
  tool("list_projects", "List projects", {}, () => store.listProjects());
  tool(
    "get_project",
    "Project with stage indexes and flow nodes",
    { projectId: id },
    (a) => store.getProject(a.projectId),
  );
  tool(
    "create_project",
    "Create project and three stage indexes",
    { title },
    (a) => store.createProject(a),
  );
  tool("update_project", "Rename project", { projectId: id, title }, (a) =>
    store.updateProject(a.projectId, { title: a.title }),
  );
  tool(
    "delete_project",
    "Delete project and its documents",
    { projectId: id },
    (a) => store.deleteProject(a.projectId),
  );
  tool("list_templates", "List document templates", {}, () =>
    store.listTemplates(),
  );
  tool(
    "get_template",
    "Read template, example and authoring prompt",
    { name: id },
    (a) => store.getTemplate(a.name),
  );
  tool(
    "list_documents",
    "List project documents, optionally children of parent",
    { projectId: id, parentId: id.optional() },
    (a) => store.listDocuments(a.projectId, a.parentId),
  );
  tool(
    "get_document",
    "Read body, extensions (React Flow nodes/edges or CodeWeave source), structured checklist and child catalog",
    { documentId: id },
    (a) => store.getDocument(a.documentId),
  );
  tool(
    "create_document",
    "Instantiate template into independent document",
    documentInput.shape,
    (a) => store.createDocument(a),
  );
  tool(
    "update_document",
    "Update body, overview or extensions; extensions replaces the full list (omit to preserve, [] to remove all). revision required",
    { documentId: id, ...documentPatch.shape },
    (a) => {
      const { documentId, ...data } = a;
      return store.updateDocument(documentId, data);
    },
  );
  tool(
    "delete_document",
    "Delete document and its descendants",
    { documentId: id, expectedRevision },
    (a) => store.deleteDocument(a.documentId, a.expectedRevision),
  );
  tool(
    "add_checklist_item",
    "Add structured checklist item",
    { documentId: id, ...checkInput.shape, expectedRevision },
    (a) =>
      store.addCheck(
        a.documentId,
        { label: a.label, position: a.position },
        a.expectedRevision,
      ),
  );
  tool(
    "update_checklist_item",
    "Update label, order or AI result; never human confirmation",
    { documentId: id, itemId: id, ...checkPatch.shape },
    (a) => {
      const { documentId, itemId, ...data } = a;
      return store.updateCheck(documentId, itemId, data);
    },
  );
  tool(
    "delete_checklist_item",
    "Delete checklist item",
    { documentId: id, itemId: id, expectedRevision },
    (a) => store.deleteCheck(a.documentId, a.itemId, a.expectedRevision),
  );
  tool(
    "reopen_document",
    "Reset only affected item IDs; preserve all others",
    { documentId: id, ...reopenInput.shape },
    (a) => {
      const { documentId, ...data } = a;
      return store.reopen(documentId, data);
    },
  );
  tool(
    "record_verification",
    "Create or update the single AI verification child document",
    { documentId: id, body, expectedRevision },
    (a) => store.recordVerification(a.documentId, a.body, a.expectedRevision),
  );
  tool("list_flow_nodes", "List project flow nodes", { projectId: id }, (a) =>
    store.listNodes(a.projectId),
  );
  tool(
    "create_flow_node",
    "Create a node linked to a document",
    { projectId: id, ...nodeInput.shape },
    (a) => {
      const { projectId, ...data } = a;
      return store.createNode(projectId, data);
    },
  );
  tool(
    "update_flow_node",
    "Update node label, order and document link",
    { projectId: id, nodeId: id, ...nodeInput.shape },
    (a) => {
      const { projectId, nodeId, ...data } = a;
      return store.updateNode(projectId, nodeId, data);
    },
  );
  tool("delete_flow_node", "Delete node", { projectId: id, nodeId: id }, (a) =>
    store.deleteNode(a.projectId, a.nodeId),
  );
  tool(
    "get_codeweave",
    "Compile and explore a CodeWeave extension. Optional line includes owned comments; query searches text/prefix/layer/comments. Node IDs belong to this source snapshot.",
    { documentId: id, extensionId: id, ...codeWeaveQuery.shape },
    ({ documentId, extensionId, ...query }) =>
      getCodeWeave(store, documentId, extensionId, query),
  );
  tool(
    "update_codeweave_node",
    "Edit CodeWeave line properties/comments using current expectedRevision and exact expectedSource. Returns a fresh compiled snapshot. Other extensions are preserved. For structural changes use update_document.",
    { documentId: id, extensionId: id, ...codeWeaveNodeEdit.shape },
    ({ documentId, extensionId, ...input }) =>
      updateCodeWeaveNode(store, documentId, extensionId, input),
  );
  return server;
}
