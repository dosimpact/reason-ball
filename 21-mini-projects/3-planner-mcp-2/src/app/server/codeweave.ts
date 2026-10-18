import {
  compileCodeWeave,
  getNodeAtLine,
  searchNodes,
  updateNode,
} from "@/modules/codeweave/core";
import {
  codeWeaveNodeEdit,
  codeWeaveQuery,
} from "@/entities/planner/codeweave";
import { DomainError, ensure } from "@/entities/planner/rules";
import type { PlannerStore } from "./store";

function readExtension(
  store: PlannerStore,
  documentId: string,
  extensionId: string,
) {
  const document = store.getDocument(documentId);
  const extension = document.extensions?.find(
    (item) => item.id === extensionId,
  );
  ensure(extension?.type === "codeweave", "CodeWeave extension not found", 404);
  return {
    document,
    extension,
    compiled: compileCodeWeave(extension.data.source),
  };
}
export function getCodeWeave(
  store: PlannerStore,
  documentId: string,
  extensionId: string,
  input: unknown = {},
) {
  const query = codeWeaveQuery.parse(input);
  const { document, extension, compiled } = readExtension(
    store,
    documentId,
    extensionId,
  );
  return {
    documentId,
    extensionId,
    title: extension.title,
    revision: document.revision,
    ...compiled,
    selected:
      query.line === undefined
        ? null
        : (getNodeAtLine(compiled, query.line) ?? null),
    matches:
      query.query === undefined ? [] : searchNodes(compiled, query.query),
  };
}
export function updateCodeWeaveNode(
  store: PlannerStore,
  documentId: string,
  extensionId: string,
  input: unknown,
) {
  const data = codeWeaveNodeEdit.parse(input);
  const { document, extension, compiled } = readExtension(
    store,
    documentId,
    extensionId,
  );
  ensure(
    document.revision === data.expectedRevision,
    "Document revision conflict",
    409,
  );
  const result = updateNode(
    compiled,
    data.nodeId,
    data.patch,
    data.expectedSource,
  );
  if (!result.ok)
    throw new DomainError(
      result.code === "conflict"
        ? 409
        : result.code === "not-found"
          ? 404
          : 400,
      result.diagnostics.map((d) => `Line ${d.line}: ${d.message}`).join("; "),
    );
  store.updateDocument(documentId, {
    expectedRevision: data.expectedRevision,
    extensions: document.extensions!.map((item) =>
      item.id === extensionId
        ? { ...extension, data: { source: result.document.source } }
        : item,
    ),
  });
  return getCodeWeave(store, documentId, extensionId, {
    line: Number(data.nodeId.slice(5)),
  });
}
