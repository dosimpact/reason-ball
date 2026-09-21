"use client";
import { useMemo, useState } from "react";
import {
  compileCodeWeave,
  collapseAll,
  expandAll,
  getNodeAtLine,
  getVisibleRows,
  setNodeExpanded,
  type TreeState,
} from "@/modules/codeweave/core";
import type { CodeWeaveExtension } from "@/entities/planner/extensions";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

export const codeWeaveExample = `[UI]
  -> EVENT: 프로젝트 생성 클릭
    -> CALL: createProject // 입력한 이름을 전달
[Application]
  -> FLOW: createProject
    -> CHECK: 이름 검증
    /*
    빈 이름이면 저장하지 않는다.
    */
    -> (+) EFFECT: 생성 알림 표시 // 추가 예정
    <- RETURN: 생성된 프로젝트
[Infrastructure]
  -> IO: 저장
    -> (-) IO: JSON 파일 저장
    -> (+) IO: SQLite 저장`;

export function CodeWeaveView({
  source,
  onChange,
}: {
  source: string;
  onChange?: (source: string) => void;
}) {
  const compiled = useMemo(() => compileCodeWeave(source), [source]);
  const [view, setView] = useState<{
    source: string;
    tree: TreeState;
    line: number | null;
  }>({ source, tree: expandAll(), line: null });
  const current =
    view.source === source ? view : { source, tree: expandAll(), line: null };
  const selected =
    current.line === null ? undefined : getNodeAtLine(compiled, current.line);
  const lines = source.split(/\r\n|\r|\n/);
  const rows = getVisibleRows(compiled, current.tree);
  const selectLine = (line: number) => setView({ ...current, line });
  return (
    <div className="codeweave-view">
      {onChange && (
        <label>
          CodeWeave 원문
          <Textarea
            aria-label="CodeWeave 원문"
            value={source}
            maxLength={50000}
            rows={12}
            spellCheck={false}
            onChange={(event) => onChange(event.target.value)}
            onClick={(event) =>
              selectLine(
                source
                  .slice(0, event.currentTarget.selectionStart)
                  .split(/\r\n|\r|\n/).length,
              )
            }
            onKeyUp={(event) =>
              selectLine(
                source
                  .slice(0, event.currentTarget.selectionStart)
                  .split(/\r\n|\r|\n/).length,
              )
            }
          />
        </label>
      )}
      <p className="muted">
        공백 2칸 = 한 단계 · -&gt; 진행 · &lt;- 반환 · (+) 추가 예정 · (-) 삭제
        예정
      </p>
      {!compiled.ok && (
        <div role="alert" className="codeweave-errors">
          <strong>문법 오류를 수정한 뒤 저장하세요.</strong>
          {compiled.diagnostics.map((d, index) => (
            <p key={index}>
              {d.line}:{d.column} {d.message}
            </p>
          ))}
        </div>
      )}
      <div className="codeweave-actions">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setView({ ...current, tree: collapseAll(compiled), line: null })
          }
        >
          전체 접기
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setView({ ...current, tree: expandAll() })}
        >
          전체 펼치기
        </Button>
        <span className="muted">
          {compiled.nodes.length}개 노드 ·{" "}
          {compiled.ok ? "문법 정상" : "부분 미리보기"}
        </span>
      </div>
      {!rows.length && (
        <p className="muted">원문을 작성하면 흐름 트리가 표시됩니다.</p>
      )}
      <div className="codeweave-tree" role="tree" aria-label="CodeWeave 흐름">
        {rows.map(({ node, expanded, expandable, tone, marker }) => (
          <div
            key={node.id}
            role="treeitem"
            aria-level={node.depth + 1}
            aria-expanded={expandable ? expanded : undefined}
            aria-selected={selected?.id === node.id}
            className={`codeweave-node ${tone}`}
          >
            <div
              className="codeweave-line"
              style={{ paddingLeft: `${node.depth * 20}px` }}
            >
              {expandable ? (
                <button
                  type="button"
                  className="codeweave-toggle"
                  aria-label={`${node.text} ${expanded ? "접기" : "펼치기"}`}
                  onClick={() =>
                    setView({
                      ...current,
                      line: null,
                      tree: setNodeExpanded(current.tree, node.id, !expanded),
                    })
                  }
                >
                  {expanded ? "▾" : "▸"}
                </button>
              ) : (
                <span className="codeweave-toggle" />
              )}
              <button
                type="button"
                className="codeweave-source-line"
                onClick={() => selectLine(node.startLine)}
                aria-label={`${node.startLine}행 ${node.text}`}
              >
                <span className="codeweave-number">{node.startLine}</span>
                <span className="codeweave-marker">{marker || " "}</span>
                <code>{lines[node.startLine - 1].trimStart()}</code>
              </button>
            </div>
            {Array.from(
              { length: node.endLine - node.startLine },
              (_, index) => node.startLine + index + 1,
            ).map((line) => (
              <button
                key={line}
                type="button"
                className="codeweave-source-line codeweave-comment"
                style={{ paddingLeft: `${node.depth * 20 + 26}px` }}
                onClick={() => selectLine(line)}
                aria-label={`${line}행 주석`}
              >
                <span className="codeweave-number">{line}</span>
                <code>{lines[line - 1]}</code>
              </button>
            ))}
          </div>
        ))}
      </div>
      {selected && (
        <section className="codeweave-detail" aria-label="CodeWeave 라인 정보">
          <h4>{current.line}행 정보</h4>
          <dl>
            {Object.entries({
              ID: selected.id,
              종류: selected.kind,
              본문: selected.text,
              방향: selected.direction ?? "없음",
              Prefix: selected.prefix ?? "없음",
              레이어: selected.layer ?? "없음",
              깊이: selected.depth,
              부모:
                compiled.nodes.find((n) => n.id === selected.parentId)?.text ??
                "없음",
              변경:
                selected.change === "added"
                  ? "(+) 추가 예정"
                  : selected.change === "removed"
                    ? "(-) 삭제 예정"
                    : "없음",
            }).map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <h4>주석</h4>
          {selected.comments.length ? (
            selected.comments.map((c, i) => (
              <div key={i}>
                <span className="muted">
                  {c.kind === "inline" ? "한 줄" : "멀티라인"} · {c.startLine}–
                  {c.endLine}행
                </span>
                <pre>{c.text}</pre>
              </div>
            ))
          ) : (
            <p className="muted">없음</p>
          )}
        </section>
      )}
    </div>
  );
}

export function CodeWeaveExtensionCard({
  extension,
  onChange,
  onRemove,
  disabled = false,
}: {
  extension: CodeWeaveExtension;
  onChange?: (value: CodeWeaveExtension) => void;
  onRemove?: () => void;
  disabled?: boolean;
}) {
  return (
    <Card className="codeweave-card">
      <CardHeader>
        <CardTitle>{extension.title}</CardTitle>
        <span className="muted">CodeWeave</span>
      </CardHeader>
      <CardContent>
        {onChange && (
          <fieldset disabled={disabled}>
            <label>
              CodeWeave 제목
              <Input
                value={extension.title}
                maxLength={160}
                onChange={(e) =>
                  onChange({ ...extension, title: e.target.value })
                }
              />
            </label>
          </fieldset>
        )}
        <CodeWeaveView
          source={extension.data.source}
          onChange={
            onChange && !disabled
              ? (source) => onChange({ ...extension, data: { source } })
              : undefined
          }
        />
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            className="danger"
            disabled={disabled}
            onClick={onRemove}
          >
            CodeWeave 제거
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
