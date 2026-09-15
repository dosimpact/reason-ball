"use client";
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  ancestors,
  flowRows,
  indexFlow,
  reconcileCollapsed,
  serializeFlowSpec,
  type FlowTree,
} from "../parser";

export function FlowSpecViewer({
  tree,
  collapsed,
  setCollapsed,
}: {
  tree: FlowTree;
  collapsed: Set<string>;
  setCollapsed: Dispatch<SetStateAction<Set<string>>>;
}) {
  const [query, setQuery] = useState(""),
    [showText, setShowText] = useState(false);
  const index = useMemo(() => indexFlow(tree), [tree]);
  const effective = reconcileCollapsed(tree, collapsed);
  const matches = query.trim()
    ? flowRows(tree).filter((r) =>
        r.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
      )
    : [];
  function reveal(id: string) {
    setShowText(false);
    setCollapsed((previous) => {
      const next = reconcileCollapsed(tree, previous);
      ancestors(id, index).forEach((parent) => next.delete(parent));
      return next;
    });
    requestAnimationFrame(() =>
      document
        .getElementById(`node-${id}`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" }),
    );
  }
  return (
    <section aria-label="Flow Spec">
      <div className="toolbar">
        <button onClick={() => setCollapsed(new Set())}>전체 펼치기</button>
        <button
          onClick={() =>
            setCollapsed(
              new Set(
                flowRows(tree)
                  .filter((r) => r.node.children.length)
                  .map((r) => r.node.id),
              ),
            )
          }
        >
          전체 접기
        </button>
        <button aria-pressed={showText} onClick={() => setShowText(!showText)}>
          {showText ? "트리 보기" : "텍스트 보기"}
        </button>
        <input
          aria-label="흐름 검색"
          placeholder="접힌 내용까지 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {query && (
        <div className="search-results">
          {matches.length
            ? matches.map((r) => (
                <button key={r.node.id} onClick={() => reveal(r.node.id)}>
                  {r.label}
                </button>
              ))
            : "검색 결과가 없습니다."}
        </div>
      )}
      {showText ? (
        <pre>{serializeFlowSpec(tree)}</pre>
      ) : (
        <div className="flow-tree">
          {flowRows(tree, effective).map(({ node, depth, label }) => (
            <div
              id={`node-${node.id}`}
              key={node.id}
              className={`flow-row ${node.kind}`}
              style={{ paddingLeft: `${depth * 24 + 12}px` }}
            >
              {node.children.length > 0 ? (
                <button
                  className="tree-toggle"
                  aria-label={`${label} ${effective.has(node.id) ? "펼치기" : "접기"}`}
                  aria-expanded={!effective.has(node.id)}
                  onClick={() =>
                    setCollapsed((previous) => {
                      const next = reconcileCollapsed(tree, previous);
                      if (next.has(node.id)) next.delete(node.id);
                      else next.add(node.id);
                      return next;
                    })
                  }
                >
                  {effective.has(node.id) ? "▸" : "▾"}
                </button>
              ) : (
                <span className="tree-spacer" />
              )}
              <span className="marker">
                {node.kind === "layer"
                  ? ""
                  : node.kind === "step"
                    ? "→"
                    : "(+)"}
              </span>
              <span>{label}</span>
              {effective.has(node.id) && node.children.length > 0 && (
                <small>{node.children.length}개 항목</small>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
