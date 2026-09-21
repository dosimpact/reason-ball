"use client";
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  CodeWeaveExtensionCard,
  codeWeaveExample,
} from "./codeweave-extension";
import type {
  DiagramExtension,
  DocumentExtension,
} from "@/entities/planner/extensions";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Plus, Trash2, Workflow } from "lucide-react";
import { useFlowMeasurements } from "./flow-measurements";
import { FitDocumentFlow } from "./fit-document-flow";

function extensionId() {
  return Array.from(crypto.getRandomValues(new Uint32Array(4)), (value) =>
    value.toString(16).padStart(8, "0"),
  ).join("");
}

export function DiagramView({
  extension,
  onChange,
}: {
  extension: DiagramExtension;
  onChange?: (value: DiagramExtension) => void;
}) {
  const { nodes, edges } = extension.data;
  const { measurements, recordMeasurements } = useFlowMeasurements();
  return (
    <div
      className="extension-diagram"
      role="group"
      aria-label={`${extension.title} 다이어그램`}
    >
      {nodes.length === 0 ? (
        <p className="muted">노드를 추가하면 다이어그램이 표시됩니다.</p>
      ) : (
        <ReactFlow
          nodes={nodes.map((node) => ({
            id: node.id,
            measured: measurements[node.id],
            position: node.position,
            data: { label: node.label },
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
          }))}
          edges={edges.map((edge) => ({
            ...edge,
            markerEnd: { type: MarkerType.ArrowClosed },
          }))}
          onNodesChange={(changes) => {
            recordMeasurements(changes);
            if (!onChange) return;
            const moved = changes.filter(
              (change) => change.type === "position" && change.position,
            );
            if (!moved.length) return;
            onChange({
              ...extension,
              data: {
                ...extension.data,
                nodes: nodes.map((node) => {
                  const change = moved.find(
                    (change) =>
                      change.type === "position" && change.id === node.id,
                  );
                  return change?.type === "position" && change.position
                    ? { ...node, position: change.position }
                    : node;
                }),
              },
            });
          }}
          onConnect={(connection) => {
            if (!onChange || edges.length >= 200) return;
            onChange({
              ...extension,
              data: {
                ...extension.data,
                edges: [
                  ...edges,
                  {
                    id: extensionId(),
                    source: connection.source,
                    target: connection.target,
                  },
                ],
              },
            });
          }}
          nodesDraggable={!!onChange}
          nodesConnectable={!!onChange}
          deleteKeyCode={null}
          zoomOnScroll={false}
          fitView
        >
          <FitDocumentFlow structure={nodes.map((n) => n.id).join("|")} />
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      )}
    </div>
  );
}

export function DocumentExtensions({
  extensions,
  onChange,
  disabled = false,
}: {
  extensions: DocumentExtension[];
  onChange?: (extensions: DocumentExtension[]) => void;
  disabled?: boolean;
}) {
  const editable = !!onChange;
  function update(extension: DocumentExtension) {
    onChange?.(
      extensions.map((item) => (item.id === extension.id ? extension : item)),
    );
  }
  return (
    <section className="document-extensions" aria-label="문서 확장">
      <div className="section-heading">
        <h3>
          <Workflow size={18} /> 확장 기능
        </h3>
        {editable && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || extensions.length >= 10}
            onClick={() =>
              onChange?.([
                ...extensions,
                {
                  id: extensionId(),
                  type: "react-flow-diagram",
                  title: "새 다이어그램",
                  schemaVersion: 1,
                  data: {
                    nodes: [
                      { id: "start", label: "시작", position: { x: 0, y: 0 } },
                      { id: "end", label: "완료", position: { x: 240, y: 0 } },
                    ],
                    edges: [
                      { id: "start-end", source: "start", target: "end" },
                    ],
                  },
                },
              ])
            }
          >
            <Plus size={14} /> React Flow 다이어그램 추가
          </Button>
        )}
        {editable && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || extensions.length >= 10}
            onClick={() =>
              onChange?.([
                ...extensions,
                {
                  id: extensionId(),
                  type: "codeweave",
                  title: "새 CodeWeave",
                  schemaVersion: 1,
                  data: { source: codeWeaveExample },
                },
              ])
            }
          >
            <Plus size={14} /> CodeWeave 추가
          </Button>
        )}
      </div>
      {extensions.length === 0 && (
        <p className="muted">첨부된 확장이 없습니다.</p>
      )}
      {editable && (
        <p className="muted">
          편집 후 문서 또는 템플릿 저장을 눌러 반영하세요. 노드를 드래그하거나
          연결점을 이어 편집할 수 있습니다.
        </p>
      )}
      {extensions.map((extension) =>
        extension.type === "codeweave" ? (
          <CodeWeaveExtensionCard
            key={extension.id}
            extension={extension}
            onChange={editable ? update : undefined}
            disabled={disabled}
            onRemove={
              editable
                ? () =>
                    onChange?.(
                      extensions.filter((item) => item.id !== extension.id),
                    )
                : undefined
            }
          />
        ) : (
          <Card key={extension.id} className="diagram-card">
            <CardHeader>
              <CardTitle>{extension.title || "다이어그램"}</CardTitle>
              <span className="muted">React Flow Diagram</span>
            </CardHeader>
            <CardContent>
              {editable && (
                <fieldset disabled={disabled} className="diagram-fields">
                  <label>
                    다이어그램 제목
                    <Input
                      value={extension.title}
                      maxLength={160}
                      onChange={(e) =>
                        update({ ...extension, title: e.target.value })
                      }
                    />
                  </label>
                  <details>
                    <summary>노드·연결 편집</summary>
                    <div className="diagram-node-list">
                      {extension.data.nodes.map((node, index) => (
                        <div key={node.id} className="diagram-node-row">
                          <label>
                            노드 {index + 1} 이름
                            <Input
                              value={node.label}
                              maxLength={160}
                              onChange={(e) =>
                                update({
                                  ...extension,
                                  data: {
                                    ...extension.data,
                                    nodes: extension.data.nodes.map((n) =>
                                      n.id === node.id
                                        ? { ...n, label: e.target.value }
                                        : n,
                                    ),
                                  },
                                })
                              }
                            />
                          </label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`노드 ${index + 1} 삭제`}
                            onClick={() =>
                              update({
                                ...extension,
                                data: {
                                  nodes: extension.data.nodes.filter(
                                    (n) => n.id !== node.id,
                                  ),
                                  edges: extension.data.edges.filter(
                                    (edge) =>
                                      edge.source !== node.id &&
                                      edge.target !== node.id,
                                  ),
                                },
                              })
                            }
                          >
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={extension.data.nodes.length >= 100}
                      onClick={() =>
                        update({
                          ...extension,
                          data: {
                            ...extension.data,
                            nodes: [
                              ...extension.data.nodes,
                              {
                                id: extensionId(),
                                label: `노드 ${extension.data.nodes.length + 1}`,
                                position: {
                                  x: (extension.data.nodes.length % 3) * 240,
                                  y:
                                    Math.floor(
                                      extension.data.nodes.length / 3,
                                    ) * 120,
                                },
                              },
                            ],
                          },
                        })
                      }
                    >
                      노드 추가
                    </Button>
                    <div className="diagram-edge-list">
                      {extension.data.edges.map((edge, index) => (
                        <div key={edge.id} className="diagram-edge-row">
                          {(["source", "target"] as const).map((side) => (
                            <label key={side}>
                              {`연결 ${index + 1} ${side === "source" ? "시작" : "도착"}`}
                              <select
                                value={edge[side]}
                                onChange={(e) =>
                                  update({
                                    ...extension,
                                    data: {
                                      ...extension.data,
                                      edges: extension.data.edges.map((item) =>
                                        item.id === edge.id
                                          ? { ...item, [side]: e.target.value }
                                          : item,
                                      ),
                                    },
                                  })
                                }
                              >
                                {extension.data.nodes.map((node) => (
                                  <option key={node.id} value={node.id}>
                                    {node.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ))}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`연결 ${index + 1} 삭제`}
                            onClick={() =>
                              update({
                                ...extension,
                                data: {
                                  ...extension.data,
                                  edges: extension.data.edges.filter(
                                    (item) => item.id !== edge.id,
                                  ),
                                },
                              })
                            }
                          >
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={
                        extension.data.nodes.length < 2 ||
                        extension.data.edges.length >= 200
                      }
                      onClick={() =>
                        update({
                          ...extension,
                          data: {
                            ...extension.data,
                            edges: [
                              ...extension.data.edges,
                              {
                                id: extensionId(),
                                source: extension.data.nodes[0].id,
                                target: extension.data.nodes[1].id,
                              },
                            ],
                          },
                        })
                      }
                    >
                      연결 추가
                    </Button>
                  </details>
                  <Button
                    type="button"
                    variant="ghost"
                    className="danger"
                    onClick={() =>
                      onChange?.(
                        extensions.filter((item) => item.id !== extension.id),
                      )
                    }
                  >
                    다이어그램 제거
                  </Button>
                </fieldset>
              )}
              <DiagramView
                extension={extension}
                onChange={editable && !disabled ? update : undefined}
              />
            </CardContent>
          </Card>
        ),
      )}
    </section>
  );
}
