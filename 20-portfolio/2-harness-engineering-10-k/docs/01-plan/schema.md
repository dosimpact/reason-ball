# Schema Document

> **Summary**: Minimal data model for the simple chatbot init feature.
>
> **Author**: Codex
> **Created**: 2026-03-21
> **Status**: Draft

---

## 1. Scope

This schema covers the logical data structures required for a minimal chatbot UI built with Next.js and the Vercel AI SDK. It is intentionally limited to in-memory client and request/response data for the first version.

## 2. Entities

- `ChatSession`: The current conversation container in the UI
- `Message`: A single user or assistant message in the conversation

## 3. Relationships

```text
ChatSession 1 -- * Message
```

## 4. Field Definitions

### ChatSession

| Field | Type | Required | Unique | Default | Description |
|------|------|----------|--------|---------|-------------|
| id | string | Yes | Yes | generated | Session identifier for the current chat instance |
| title | string | No | No | "New Chat" | Optional display label for the conversation |
| createdAt | string (ISO datetime) | Yes | No | now | Session creation timestamp |
| updatedAt | string (ISO datetime) | Yes | No | now | Last message update timestamp |
| messages | Message[] | Yes | No | [] | Ordered list of chat messages |

### Message

| Field | Type | Required | Unique | Default | Description |
|------|------|----------|--------|---------|-------------|
| id | string | Yes | Yes | generated | Message identifier used for rendering and updates |
| role | enum | Yes | No | - | `user`, `assistant`, or `system` |
| content | string | Yes | No | - | Message text content |
| createdAt | string (ISO datetime) | Yes | No | now | Message creation timestamp |

## 5. Validation Rules

- `ChatSession.id` must be non-empty.
- `Message.id` must be non-empty.
- `Message.role` must be one of `user`, `assistant`, or `system`.
- `Message.content` must be a non-empty string after trimming for submitted user prompts.
- Message order must be preserved in the `messages` array.

## 6. Out of Scope

- Database tables or migrations
- User accounts and ownership mapping
- Persistent message history
- Attachments, tools, or multimodal payloads

## 7. Related Documents

- Plan: [simple-chatbot-init.plan.md](./features/simple-chatbot-init.plan.md)
- Glossary: [glossary.md](./glossary.md)
- ERD: [erd.md](./erd.md)
