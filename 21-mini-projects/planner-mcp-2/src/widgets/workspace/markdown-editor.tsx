"use client";
import { useEffect, useRef, useState } from "react";
import {
  EditorContent,
  useEditor,
  type Editor,
  type ChainedCommands,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import { MarkdownView } from "@/entities/planner/document-view";

const blocks = [
  {
    name: "본문",
    key: "text",
    run: (e: ChainedCommands) => e.setParagraph().run(),
  },
  {
    name: "제목 1",
    key: "h1",
    run: (e: ChainedCommands) => e.toggleHeading({ level: 1 }).run(),
  },
  {
    name: "제목 2",
    key: "h2",
    run: (e: ChainedCommands) => e.toggleHeading({ level: 2 }).run(),
  },
  {
    name: "제목 3",
    key: "h3",
    run: (e: ChainedCommands) => e.toggleHeading({ level: 3 }).run(),
  },
  {
    name: "글머리 목록",
    key: "bullet",
    run: (e: ChainedCommands) => e.toggleBulletList().run(),
  },
  {
    name: "번호 목록",
    key: "number",
    run: (e: ChainedCommands) => e.toggleOrderedList().run(),
  },
  {
    name: "체크 목록",
    key: "task",
    run: (e: ChainedCommands) => e.toggleTaskList().run(),
  },
  {
    name: "인용",
    key: "quote",
    run: (e: ChainedCommands) => e.toggleBlockquote().run(),
  },
  {
    name: "코드 블록",
    key: "code",
    run: (e: ChainedCommands) => e.toggleCodeBlock().run(),
  },
  {
    name: "Mermaid",
    key: "mermaid",
    run: (e: ChainedCommands) =>
      e
        .setCodeBlock({ language: "mermaid" })
        .insertContent("flowchart LR\n  A[시작] --> B[완료]")
        .run(),
  },
  {
    name: "표",
    key: "table",
    run: (e: ChainedCommands) =>
      e.insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run(),
  },
  {
    name: "구분선",
    key: "divider",
    run: (e: ChainedCommands) => e.setHorizontalRule().run(),
  },
];
type Slash = { query: string; from: number; to: number; index: number };

export function MarkdownEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [mode, setMode] = useState("visual");
  const [slash, setSlash] = useState<Slash | null>(null);
  const emitted = useRef(value);
  // Preserve unsupported Markdown verbatim using the source editor.
  const outsideCode = value.replace(
    /(^|\n)(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\2[ \t]*(?=\n|$)/g,
    "\n",
  );
  const needsSource =
    /(^|\n)\s*(?:<\/?[a-zA-Z!]|\[[^\]]+\]:|:::)|\[\^[^\]]+\]/.test(
      outsideCode,
    ) || /^---\r?\n[\s\S]*?\n---(?:\n|$)/.test(outsideCode);
  function updateSlash(e: Editor) {
    const { $from, empty } = e.state.selection;
    const text = $from.parent.textBetween(0, $from.parentOffset);
    const match =
      empty &&
      $from.parent.type.name === "paragraph" &&
      /^\/([^\s]*)$/.exec(text);
    if (!match) {
      setSlash(null);
      return;
    }
    setSlash((previous) => ({
      query: match[1],
      from: $from.start(),
      to: $from.pos,
      index: previous?.query === match[1] ? previous.index : 0,
    }));
  }
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({ underline: false, link: { openOnClick: false } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit,
      Image,
      Placeholder.configure({
        placeholder: "내용을 입력하거나 / 로 블록을 추가하세요…",
      }),
      Markdown.configure({ markedOptions: { gfm: true } }),
    ],
    content: needsSource ? "" : value,
    contentType: "markdown",
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": label,
        "aria-multiline": "true",
        class: "notion-content",
      },
    },
    onUpdate: ({ editor: e }) => {
      const markdown = e.getMarkdown();
      emitted.current = markdown;
      onChange(markdown);
      updateSlash(e);
    },
    onSelectionUpdate: ({ editor: e }) => updateSlash(e),
  });
  useEffect(() => {
    if (!editor || emitted.current === value) return;
    emitted.current = value;
    editor.commands.setContent(needsSource ? "" : value, {
      contentType: "markdown",
      emitUpdate: false,
    });
  }, [editor, value, needsSource]);
  const visibleMode = needsSource && mode === "visual" ? "source" : mode;
  const matches = blocks.filter((block) =>
    `${block.name} ${block.key}`
      .toLowerCase()
      .includes(slash?.query.toLowerCase() ?? ""),
  );
  function choose(index: number) {
    if (!editor || !slash || !matches[index]) return;
    matches[index].run(
      editor.chain().focus().deleteRange({ from: slash.from, to: slash.to }),
    );
    setSlash(null);
  }
  const listType = editor?.isActive("taskItem") ? "taskItem" : "listItem";
  return (
    <section className="markdown-editor" aria-label={`${label} 편집기`}>
      <div className="markdown-editor-header">
        <strong>{label}</strong>
        <div
          className="markdown-modes"
          role="group"
          aria-label={`${label} 편집 모드`}
        >
          {[
            ["visual", "서식 편집"],
            ["source", "Markdown"],
            ["preview", "미리보기"],
          ].map(([key, name]) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant="ghost"
              aria-pressed={visibleMode === key}
              disabled={key === "visual" && needsSource}
              onClick={() => {
                setMode(key);
                setSlash(null);
              }}
            >
              {name}
            </Button>
          ))}
        </div>
      </div>
      {needsSource && (
        <p className="muted editor-hint">
          HTML·각주 등 확장 문법은 원문 보존을 위해 Markdown 모드에서
          편집합니다.
        </p>
      )}
      {visibleMode === "source" && (
        <Textarea
          aria-label={label}
          value={value}
          rows={10}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {visibleMode === "preview" && (
        <div className="editor-preview">
          <MarkdownView body={value} />
        </div>
      )}
      <div
        hidden={visibleMode !== "visual"}
        onKeyDownCapture={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (slash) {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              setSlash(null);
            } else if (
              matches.length &&
              ["ArrowDown", "ArrowUp", "Enter"].includes(event.key)
            ) {
              event.preventDefault();
              event.stopPropagation();
              if (event.key === "Enter") choose(slash.index % matches.length);
              else
                setSlash({
                  ...slash,
                  index:
                    (slash.index +
                      (event.key === "ArrowDown" ? 1 : -1) +
                      matches.length) %
                    matches.length,
                });
            }
          } else if (
            event.key === "Tab" &&
            editor &&
            (editor.isActive("listItem") || editor.isActive("taskItem"))
          ) {
            event.preventDefault();
            if (event.shiftKey)
              editor.chain().focus().liftListItem(listType).run();
            else editor.chain().focus().sinkListItem(listType).run();
          }
        }}
      >
        <div
          className="editor-toolbar"
          role="toolbar"
          aria-label={`${label} 서식 도구`}
        >
          <select
            aria-label={`${label} 블록 종류`}
            value=""
            disabled={!editor}
            onChange={(event) => {
              blocks
                .find((block) => block.key === event.target.value)
                ?.run(editor!.chain().focus());
            }}
          >
            <option value="" disabled>
              블록 추가 / 변경
            </option>
            {blocks.map((block) => (
              <option value={block.key} key={block.key}>
                {block.name}
              </option>
            ))}
          </select>
          {[
            {
              name: "굵게",
              text: "B",
              active: editor?.isActive("bold"),
              run: () => editor?.chain().focus().toggleBold().run(),
            },
            {
              name: "기울임",
              text: "I",
              active: editor?.isActive("italic"),
              run: () => editor?.chain().focus().toggleItalic().run(),
            },
            {
              name: "취소선",
              text: "S̶",
              active: editor?.isActive("strike"),
              run: () => editor?.chain().focus().toggleStrike().run(),
            },
            {
              name: "인라인 코드",
              text: "</>",
              active: editor?.isActive("code"),
              run: () => editor?.chain().focus().toggleCode().run(),
            },
          ].map((action) => (
            <Button
              key={action.name}
              type="button"
              variant="ghost"
              size="sm"
              title={action.name}
              aria-label={action.name}
              aria-pressed={!!action.active}
              disabled={!editor}
              onMouseDown={(event) => event.preventDefault()}
              onClick={action.run}
            >
              {action.text}
            </Button>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            title="내어쓰기 (Shift+Tab)"
            aria-label="← 내어쓰기"
            disabled={!editor?.can().liftListItem(listType)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor?.chain().focus().liftListItem(listType).run()}
          >
            ←
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            title="들여쓰기 (Tab)"
            aria-label="→ 들여쓰기"
            disabled={!editor?.can().sinkListItem(listType)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor?.chain().focus().sinkListItem(listType).run()}
          >
            →
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="실행 취소"
            disabled={!editor?.can().undo()}
            onClick={() => editor?.chain().focus().undo().run()}
          >
            ↶
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="다시 실행"
            disabled={!editor?.can().redo()}
            onClick={() => editor?.chain().focus().redo().run()}
          >
            ↷
          </Button>
          {editor?.isActive("table") && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().addRowAfter().run()}
              >
                행 추가
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().addColumnAfter().run()}
              >
                열 추가
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().deleteTable().run()}
              >
                표 삭제
              </Button>
            </>
          )}
        </div>
        <EditorContent editor={editor} />
        {slash && (
          <div
            className="slash-menu"
            role="listbox"
            aria-label={`${label} 블록 메뉴`}
          >
            {matches.length ? (
              matches.map((block, index) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={index === slash.index % matches.length}
                  key={block.key}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(index)}
                >
                  {block.name}
                  <span>/{block.key}</span>
                </button>
              ))
            ) : (
              <p>일치하는 블록이 없습니다.</p>
            )}
          </div>
        )}
        <p className="editor-hint muted">
          / 블록 추가 · 목록: → 들여쓰기(Tab), ← 내어쓰기(Shift+Tab) · 변경 후
          저장
        </p>
      </div>
    </section>
  );
}
