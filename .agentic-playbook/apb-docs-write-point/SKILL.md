---
name: apb-docs-write-point
description: |
  Write or refactor Markdown and MDX documentation as a beginner-friendly,
  point-by-point explanation that preserves technical accuracy while turning
  definitions, distinctions, examples, and cautions into a readable narrative.
  Phase: Write Point Document.
  Triggers: write point document, point-by-point guide, beginner explanation,
  refactor documentation, 포인트 형식 문서, 초심자 해설, 문서 리팩터링,
  ポイント形式, 初心者向け解説, 要点式文档, 初学者说明.
  Do NOT use for: API reference generation, release notes, source-code refactoring,
  or documents that must preserve a strict external template.
---

# APB Docs Write Point

> Write or refactor documentation as a sequence of self-contained points for a beginner audience.

## Usage

```
$apb-docs-write-point write {topic}            Write a new point-based document
$apb-docs-write-point refactor {document}      Refactor an existing document in place
```

## Phase Flow

```
[Write Point Document]
```

## Phase Progress Visualization

```
[Write Point Document]

Status:
  [Write Point Document] done     -> document written and validated
  [Write Point Document] active   -> currently writing or refactoring
  [Write Point Document] pending  -> not yet started
```

---

## Phase:Write Point Document

Transform source material into a progressive point-by-point explanation and validate the result in its project context.

### Prerequisites

- Read the target repository's instructions and inspect nearby documents for front matter, heading, naming, and tone conventions.
- Identify the source material, target document, intended audience, and facts that must remain unchanged.
- When the target path is not specified, locate the most relevant documentation section before creating a file.
- Preserve unrelated user changes and do not overwrite an existing document without first reading it.

### Steps

1. Read the complete source and extract its central claim, definitions, commonly confused distinctions, application guidance, examples, and cautions.
2. Choose only the points needed to explain the topic. Prefer 3–7 substantial points, but use fewer or more when the material requires it. Give each point one clear teaching purpose.
3. Order the points from foundation to application:
   - explain why the topic matters;
   - define the core concept;
   - distinguish easily confused ideas;
   - show practical application;
   - provide a concrete example;
   - close with limitations or a checklist.
4. Start the body with this framing, adapted to the topic:

   ```markdown
   [{Topic} - 초심자 해설]

   이번 문서에서 주목할 포인트 몇 가지를 짚어 보겠습니다.
   ```

5. Write every section with a descriptive heading rather than a bare label:

   ```markdown
   ## 포인트 1. {the point's conclusion in one sentence}

   {Explain the idea in connected prose. Add a concrete example or contrast
   when it improves understanding.}
   ```

6. Lead each point with its conclusion, then explain why it is true and how it applies. Use approachable prose without weakening necessary technical terms.
7. Keep paragraphs focused. Use bullets for compact enumerations, numbered lists for procedures, and tables only when repeated mappings or comparisons are clearer than prose.
8. Preserve the source's verified facts, constraints, links, code, and examples. Correct contradictions that can be resolved from project context; otherwise flag uncertainty instead of inventing an answer.
9. When refactoring, retain useful content rather than shortening mechanically. Remove only duplication, fragmented notes, empty headings, or details that do not support any point.
10. End with a practical takeaway, checklist, or boundary that tells the reader how to use the concept without overgeneralizing it.
11. Re-read the result and confirm:
    - each point can be summarized in one sentence;
    - adjacent points do not repeat the same lesson;
    - terminology and examples remain internally consistent;
    - a beginner can follow the document without missing context;
    - front matter, links, Markdown/MDX, and sidebar placement follow repository conventions.
12. Run the repository's required documentation validation command. For a Docusaurus project using Yarn 1, run `yarn build` unless repository instructions specify otherwise.

### Output Path

Write new documents under the repository's documentation root, or update the selected document in place:

```
./docs/
```
