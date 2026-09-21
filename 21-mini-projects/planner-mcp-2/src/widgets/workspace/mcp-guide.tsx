"use client";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";
import { useState } from "react";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export function McpGuide({ tools }: { tools: Tool[] }) {
  const [query, setQuery] = useState("");
  const matches = tools.filter((tool) =>
    `${tool.name} ${tool.description ?? ""}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  return (
    <section className="mcp-guide">
      <span className="eyebrow">AI MCP INTERFACE</span>
      <h1>AI MCP Interface 안내</h1>
      <Badge variant="secondary">실시간 도구 명세 · {tools.length}개</Badge>
      <p>AI가 설계를 읽고 구현·검증 상태를 기록할 때 사용하는 도구입니다.</p>
      <div className="mcp-guide-intro">
        <p>
          <strong>연결 경로</strong> <code>/mcp</code> · Streamable HTTP
        </p>
        <p>
          현재 사이트 주소 뒤에 <code>/mcp</code>를 붙여 MCP 클라이언트에
          등록하세요. 먼저 <code>get_workflow_rules</code>로 작업 규칙을
          확인합니다. 사람의 최종 확인은 UI에서 진행합니다.
        </p>
        <p className="muted">
          실행 중인 MCP 서버에서 자동 생성한 명세입니다. 도구 변경을 배포하면
          페이지를 다시 열거나 새로고침할 때 반영됩니다.
        </p>
      </div>
      <label>
        도구 검색
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="도구 이름 또는 설명"
          type="search"
        />
      </label>
      <p role="status">
        전체 {tools.length}개 · 표시 {matches.length}개
      </p>
      {matches.length > 0 && (
        <details className="mcp-toc">
          <summary>도구 목차 · {matches.length}개</summary>
          <nav aria-label="MCP 도구 목차">
            <ul>
              {matches.map((tool) => (
                <li key={tool.name}>
                  <a href={`#mcp-tool-${tool.name}`}>
                    <code>{tool.name}</code>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </details>
      )}
      {matches.length === 0 && <p>검색 결과가 없습니다.</p>}
      <div className="mcp-tool-list">
        {matches.map((tool) => (
          <article
            key={tool.name}
            id={`mcp-tool-${tool.name}`}
            className="mcp-tool"
            aria-label={tool.name}
            tabIndex={-1}
          >
            <h2>
              <code>{tool.name}</code>
            </h2>
            <p>{tool.description || "설명이 등록되지 않았습니다."}</p>
            <h3>입력 파라미터</h3>
            {Object.keys(tool.inputSchema.properties ?? {}).length === 0 ? (
              <p className="muted">입력 파라미터 없음</p>
            ) : (
              <dl className="mcp-parameters">
                {Object.entries(tool.inputSchema.properties ?? {}).map(
                  ([name, schema]) => (
                    <div key={name}>
                      <dt>
                        <code>{name}</code>{" "}
                        <span className="muted">
                          {tool.inputSchema.required?.includes(name)
                            ? "필수"
                            : "선택"}
                        </span>
                      </dt>
                      <dd>
                        <span className="muted">
                          {describeParameter(schema)}
                        </span>
                      </dd>
                    </div>
                  ),
                )}
              </dl>
            )}
            <details>
              <summary>전체 입력 JSON Schema</summary>
              <pre>{JSON.stringify(tool.inputSchema, null, 2)}</pre>
            </details>
            {tool.outputSchema && (
              <details>
                <summary>출력 JSON Schema</summary>
                <pre>{JSON.stringify(tool.outputSchema, null, 2)}</pre>
              </details>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function describeParameter(schema: unknown): string {
  if (!schema || typeof schema !== "object") return "서버 명세 참조";
  const value = schema as Record<string, unknown>;
  const type =
    typeof value.type === "string"
      ? value.type
      : Array.isArray(value.enum)
        ? "enum"
        : "object";
  return typeof value.description === "string"
    ? `${type} · ${value.description}`
    : type;
}
