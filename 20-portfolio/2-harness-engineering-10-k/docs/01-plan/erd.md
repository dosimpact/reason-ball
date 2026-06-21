# ERD

> **Summary**: Logical relationships for the simple chatbot init feature.
>
> **Author**: Codex
> **Created**: 2026-03-21
> **Status**: Draft

---

## Relationship Overview

This feature does not include persistent database storage. The ERD below describes the logical in-memory structure used by the chat UI.

```text
ChatSession 1 -- * Message
Message    * -- 1 Role
```

## Notes

- `ChatSession` groups the visible conversation state during one browser session.
- `Message` is the core repeated item rendered in the chat list.
- `Role` classifies message ownership and rendering behavior.
- Persistence is out of scope for this phase, so no database tables are defined yet.
