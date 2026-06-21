# AI Chat Application Security Controls

Access date: 2026-06-10

Scope: security requirements for an AI chat application, including standard chatbot, RAG chatbot, copilots, and tool-using agents.

## Maturity Threshold

Total requirement count: **30**

| Level | Required Items | Gate |
|---|---:|---|
| L0 Unsafe | 0-7 | Do not launch beyond local experiments. |
| L1 Foundation | 8-15 | Basic design review and internal prototype only. |
| L2 Controlled Pilot | 16-23 | Limited users/data, all Critical items complete. |
| L3 Stable Production | 24-27 | All Critical items complete, at least 11 High items complete, monitoring and incident response active. |
| L4 High Assurance | 28-30 | Continuous red teaming, audit evidence, and lifecycle governance complete. |

For production stability, target **24/30 or more**, complete all Critical items, and formally compensate or accept any remaining High gap.

## Requirement Inventory

| ID | Priority | Requirement | Evidence / Verification |
|---|---|---|---|
| SEC-001 | Critical | Maintain inventory of AI apps, models, agents, tools, data sources, owners, and environments. | Current inventory and owner map. |
| SEC-002 | Critical | Perform AI threat modeling before launch and after major prompt/model/tool changes. | Threat model covering OWASP LLM and agentic risks. |
| SEC-003 | High | Classify data allowed in prompts, retrieval sources, logs, fine-tuning, and analytics. | Data handling matrix and prohibited data list. |
| SEC-004 | High | Review model, plugin, tool, dataset, and vendor supply chain risks. | Vendor review, SBOM/AIBOM where available. |
| SEC-005 | High | Control model, prompt, policy, and provider changes through approval, testing, and rollback. | Version history, release notes, rollback plan. |
| SEC-006 | Critical | Enforce strong user authentication, session management, and app authorization. | ASVS-aligned auth/access tests. |
| SEC-007 | Critical | Enforce tenant, workspace, and user data isolation across chat history, RAG, tools, and logs. | Isolation tests and access-control test cases. |
| SEC-008 | Critical | Apply least privilege to agents, tools, APIs, service accounts, and MCP servers. | Permission review and scoped credentials. |
| SEC-009 | Critical | Manage secrets outside prompts, files, chat history, telemetry, and model-visible context. | Secret scanning and vault integration. |
| SEC-010 | Critical | Detect and mitigate direct and indirect prompt injection. | Red-team tests and runtime guardrail results. |
| SEC-011 | High | Detect jailbreaks, abuse prompts, unsafe requests, and policy-bypass attempts. | Abuse test suite and moderation logs. |
| SEC-012 | High | Sanitize and scan files, URLs, images, audio, documents, and retrieved content before model use. | Ingestion security tests. |
| SEC-013 | High | Protect system prompts, hidden policies, chain-of-thought, and internal instructions from leakage. | Prompt leak tests and response filtering. |
| SEC-014 | Critical | Prevent sensitive data disclosure and exfiltration in inputs, retrieved context, outputs, and tool calls. | DLP tests and blocked exfiltration cases. |
| SEC-015 | Critical | Enforce authorization and metadata filtering for RAG retrieval. | Retrieval access-control tests. |
| SEC-016 | High | Protect vector stores, embeddings, memory, and RAG data from poisoning and unauthorized access. | Index access review and poisoning tests. |
| SEC-017 | High | Validate and sanitize model outputs before display or downstream execution. | Output schema validation and unsafe output tests. |
| SEC-018 | Medium | Ground factual answers with source attribution, confidence handling, and hallucination controls. | Factuality evals and citation checks. |
| SEC-019 | High | Filter harmful, illegal, toxic, regulated, or policy-violating content. | Safety evals and escalation workflow. |
| SEC-020 | Critical | Restrict tool use with allowlists, schema validation, argument checks, and safe execution boundaries. | Tool-call test cases and denied action logs. |
| SEC-021 | High | Require human approval for high-impact actions such as payments, deletes, external sends, or privilege changes. | Approval workflow tests. |
| SEC-022 | High | Enforce rate limits, cost budgets, token limits, recursion limits, and transaction limits. | Load, abuse, and cost-control tests. |
| SEC-023 | High | Govern agent memory: retention, user visibility, poisoning resistance, deletion, and review. | Memory lifecycle tests. |
| SEC-024 | Critical | Log prompts, outputs, retrievals, tool calls, policy decisions, and security events with privacy controls. | Audit log review and retention policy. |
| SEC-025 | Critical | Monitor runtime behavior for anomalies, attacks, unsafe tool use, and data leakage. | Alerts, dashboards, and detection tests. |
| SEC-026 | High | Run pre-release and continuous AI red teaming/evaluations in CI/CD and production-like environments. | Eval reports and regression gates. |
| SEC-027 | Critical | Maintain AI incident response: disable model/tool paths, notify owners, preserve evidence, and recover safely. | Tabletop exercise and runbook. |
| SEC-028 | High | Protect availability against model DoS, prompt flooding, expensive chains, and provider outage. | Fallback and resilience tests. |
| SEC-029 | Medium | Version and audit prompts, models, guardrails, datasets, embeddings, and policies. | Version registry and approval trail. |
| SEC-030 | Medium | Provide user transparency, consent, reporting, appeal, and feedback channels. | UX review and feedback handling records. |

## Priority Summary

- Critical: 13 items
- High: 14 items
- Medium: 3 items

Stable production requires all 13 Critical items, at least 11 of 14 High items, and at least 24 total implemented items. Remaining High gaps require documented compensating controls or risk acceptance. Medium items may be phased, but should be closed for high-assurance operation.
