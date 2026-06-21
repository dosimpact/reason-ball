# Straiker AI Evaluation

Access date: 2026-06-10

## Public Product Summary

Straiker positions itself as an AI-native security platform for agentic AI. Public materials describe three products:

- **Discover AI**: AI agent inventory and posture management. It identifies agents, tools, MCP servers, risky permissions, unsafe integrations, misconfigurations, and unknown deployments.
- **Ascend AI**: AI red teaming. It tests web applications, agentic workflows, models, identities, tools, and data; supports scheduled, on-demand, and CI/CD-triggered assessments.
- **Defend AI**: Runtime security and guardrails. It monitors prompts, reasoning steps, tool calls, file inputs, and multimodal content to detect or block prompt injection, data exfiltration, agent manipulation, jailbreaks, unsafe tool use, toxic output, policy violations, and MCP risks.

This evaluation uses public information only. No private demo, benchmark data, contract terms, architecture documents, or customer deployment evidence were reviewed.

## Coverage Summary

| Status | Count | Meaning |
|---|---:|---|
| Full | 12 | Public materials directly support the control objective. |
| Partial | 12 | Straiker can help, but application, governance, or operational controls are still required. |
| Gap | 6 | No clear public evidence that Straiker addresses the control. |

Weighted score: **18/30** if Full = 1, Partial = 0.5, Gap = 0.

Conclusion: Straiker appears strong for runtime AI protection, red teaming, agent inventory, MCP/tool visibility, and forensics. It should not be treated as a complete AI chat security program by itself because core application security, data governance, tenant isolation, human approval workflows, resilience, and user transparency remain implementation responsibilities.

## Coverage Matrix

| ID | Coverage | Straiker Fit | Notes |
|---|---|---|---|
| SEC-001 | Full | Discover AI | Agent, tool, MCP, and integration inventory. |
| SEC-002 | Partial | Ascend AI, Discover AI | Supports testing and findings, but does not replace threat modeling. |
| SEC-003 | Partial | Defend AI | Can enforce configured policies; data classification remains internal. |
| SEC-004 | Partial | Discover AI, Ascend AI | Helps with AI/MCP/tool posture; procurement and vendor review remain internal. |
| SEC-005 | Partial | Ascend AI | CI/CD-triggered assessments help, but version/rollback governance is separate. |
| SEC-006 | Gap | None public | User auth and session security are app controls. |
| SEC-007 | Gap | None public | Tenant/workspace isolation must be built into app and data layers. |
| SEC-008 | Full | Discover AI, Defend AI | Public claims include excessive permissions and risky connections. |
| SEC-009 | Partial | Defend AI | Helps block secret exfiltration; secret storage and rotation remain internal. |
| SEC-010 | Full | Defend AI, Ascend AI | Direct and indirect prompt injection are core claimed capabilities. |
| SEC-011 | Full | Defend AI | Public claims include jailbreaks and policy violations. |
| SEC-012 | Full | Defend AI | Public claims include multimodal/file threat detection. |
| SEC-013 | Full | Defend AI | Guardrails page references system prompt leak coverage. |
| SEC-014 | Full | Defend AI | Public claims include PII, PCI, HIPAA, code, and secret exfiltration detection. |
| SEC-015 | Partial | Defend AI | Helps detect data leakage, but retrieval authorization must be implemented. |
| SEC-016 | Partial | Ascend AI, Defend AI | Can test/monitor AI risks; vector-store controls are not fully evidenced publicly. |
| SEC-017 | Partial | Defend AI | Output safety is covered; schema validation and downstream encoding are app controls. |
| SEC-018 | Partial | Defend AI | Guardrails mention grounding/hallucinations; factual QA design remains required. |
| SEC-019 | Full | Defend AI | Toxic output and policy violations are public guardrail claims. |
| SEC-020 | Full | Defend AI, Discover AI | Tool/MCP security and risky integration visibility are strong fit areas. |
| SEC-021 | Gap | None public | Human approval workflows are not clearly covered. |
| SEC-022 | Gap | None public | Rate, budget, recursion, and transaction limits are app/platform controls. |
| SEC-023 | Partial | Defend AI, Ascend AI | Agent manipulation is covered; memory lifecycle governance remains unclear. |
| SEC-024 | Full | Defend AI | Public claims include traces, audit logs, and chain-of-threat forensics. |
| SEC-025 | Full | Defend AI | Runtime monitoring, alerts, and anomaly detection are public claims. |
| SEC-026 | Full | Ascend AI | Continuous, scheduled, on-demand, and CI/CD red teaming are public claims. |
| SEC-027 | Partial | Defend AI | Forensics and alerts help, but IR runbooks and recovery remain internal. |
| SEC-028 | Gap | None public | Availability, cost, and provider-failure resilience are not evidenced. |
| SEC-029 | Partial | Ascend AI | Tests prompt/model changes; version registry and rollback remain internal. |
| SEC-030 | Gap | None public | User consent, appeal, and transparency are product/UX obligations. |

## Recommended Use

Use Straiker as a specialized AI security layer for:

- AI agent discovery and posture management.
- Continuous AI red teaming before and after deployment.
- Runtime prompt injection, data leakage, tool misuse, and unsafe output protection.
- Chain-of-threat forensics and AI security observability.

Pair it with internal controls for authentication, authorization, tenant isolation, data classification, secret management, human approval, incident response, resilience, and user transparency.
