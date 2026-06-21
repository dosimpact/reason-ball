# AI Chat Application Security Requirements and Straiker AI Coverage Report

Access date: 2026-06-10

## Executive Summary

This report defines **30 security requirements** for building an AI chat application and evaluates how much Straiker AI appears to cover based on public sources.

Recommended stability threshold: an AI chat application should satisfy **at least 24/30 requirements**, with all Critical controls complete and no unmanaged High gaps, before broad production rollout. High-assurance operation should target **28-30/30** with continuous red teaming, monitoring, audit evidence, and lifecycle governance.

Straiker AI appears to cover **12 controls fully**, **12 partially**, and leaves **6 clear gaps**. Weighted score: **18/30** using Full = 1, Partial = 0.5, Gap = 0. It is a strong fit for AI-specific runtime defense, red teaming, agent inventory, MCP/tool security, and forensics, but it does not replace application security engineering or governance.

## Method

Requirements were derived from OWASP LLM Top 10 2025, OWASP Agentic AI guidance, NIST AI 600-1, CSA AI Controls Matrix, MITRE ATLAS, and OWASP ASVS. Straiker coverage was evaluated from public Straiker product and solution pages only. Vendor performance claims were not independently verified.

## Security Requirement Set

Total items: **30**

| Area | Requirement IDs |
|---|---|
| Governance and lifecycle | SEC-001 to SEC-005, SEC-029, SEC-030 |
| Identity, access, and isolation | SEC-006 to SEC-009 |
| Prompt, input, and content protection | SEC-010 to SEC-013, SEC-019 |
| Data, RAG, and output safety | SEC-014 to SEC-018 |
| Agents, tools, and MCP | SEC-020 to SEC-023 |
| Monitoring, testing, and operations | SEC-024 to SEC-028 |

Full requirement details are maintained in `requirements/ai-chat-security-controls.md`.

## Maturity and Roadmap

| Level | Required Count | Milestone | Action Items |
|---|---:|---|---|
| L0 Unsafe | 0-7 | Local experiment only | Do not use real users, production data, tools, or external actions. |
| L1 Foundation | 8-15 | Internal prototype | Complete inventory, threat model, auth, basic logging, data rules, and prompt-injection tests. |
| L2 Controlled Pilot | 16-23 | Limited pilot | Add RAG authorization, DLP, output validation, tool allowlists, rate limits, and release gates. |
| L3 Stable Production | 24-27 | Broad production | Complete all Critical controls, most High controls, runtime monitoring, incident response, red teaming, and rollback. |
| L4 High Assurance | 28-30 | Regulated or high-risk use | Add audit evidence, continuous evals, user appeal, transparency, resilience, and lifecycle governance. |

Minimum stable target: **24/30**. If any Critical control is missing, the system should remain at L1 or L2 regardless of count. Any remaining High gap needs compensating controls or explicit risk acceptance.

## Straiker AI Research Summary

Straiker describes three relevant capabilities:

- **Discover AI**: inventories AI agents, tools, MCP servers, integrations, risky permissions, unsafe connections, and misconfigurations.
- **Ascend AI**: performs continuous, scheduled, on-demand, and CI/CD-triggered AI red teaming across applications, workflows, identities, tools, models, and data.
- **Defend AI**: provides runtime guardrails for prompt injection, jailbreaks, data exfiltration, agent manipulation, tool/MCP risks, unsafe outputs, toxic content, multimodal inputs, alerting, and chain-of-threat forensics.

Based on public documentation, Straiker is most useful after the application has basic engineering controls in place. It can materially improve AI-specific detection, testing, and runtime enforcement, but the product does not appear to own tenant isolation, application authentication, data classification, human approval workflow design, provider resilience, or end-user transparency.

## Coverage Matrix

| ID | Requirement | Coverage | Comment |
|---|---|---|---|
| SEC-001 | AI inventory | Full | Discover AI directly supports inventory and posture visibility. |
| SEC-002 | Threat modeling | Partial | Ascend AI helps test risk, but architecture threat modeling remains internal. |
| SEC-003 | Data classification | Partial | Defend AI can enforce policies, but classification must be defined internally. |
| SEC-004 | Supply chain review | Partial | Helps with AI/MCP/tool posture; contracts and vendor due diligence remain internal. |
| SEC-005 | Change control | Partial | CI/CD testing helps; versioning and rollback need internal process. |
| SEC-006 | Authentication | Gap | No public evidence of app auth coverage. |
| SEC-007 | Tenant isolation | Gap | Must be implemented in app/data architecture. |
| SEC-008 | Least privilege | Full | Discover AI identifies risky permissions and connections. |
| SEC-009 | Secret management | Partial | Can detect exfiltration, but not secret lifecycle management. |
| SEC-010 | Prompt injection defense | Full | Core Defend AI and Ascend AI fit. |
| SEC-011 | Jailbreak and abuse detection | Full | Core runtime guardrail fit. |
| SEC-012 | File and multimodal input scanning | Full | Defend AI claims multimodal and file-input threat detection. |
| SEC-013 | System prompt leakage | Full | Guardrails page names system prompt leak coverage. |
| SEC-014 | Sensitive data leakage | Full | Defend AI claims PII, PCI, HIPAA, code, and secret exfiltration detection. |
| SEC-015 | RAG authorization | Partial | Leakage detection helps, but retrieval ACLs must be built. |
| SEC-016 | Vector and memory protection | Partial | Testing may help; vector-store controls are not fully public. |
| SEC-017 | Output validation | Partial | Output safety helps; schema validation and encoding remain app controls. |
| SEC-018 | Grounding and hallucination controls | Partial | Guardrails mention grounding/hallucinations; factual QA remains app work. |
| SEC-019 | Harmful content filtering | Full | Defend AI claims toxic and policy-violating output protection. |
| SEC-020 | Tool/MCP controls | Full | Strong fit through Discover AI and Defend AI. |
| SEC-021 | Human approval | Gap | No clear public support for approval workflows. |
| SEC-022 | Rate, cost, and transaction limits | Gap | Platform/application control. |
| SEC-023 | Agent memory governance | Partial | Agent manipulation coverage helps; lifecycle governance unclear. |
| SEC-024 | Audit logging and traces | Full | Defend AI claims traces, audit logs, and forensics. |
| SEC-025 | Runtime monitoring | Full | Core Defend AI capability. |
| SEC-026 | Red teaming and evals | Full | Core Ascend AI capability. |
| SEC-027 | Incident response | Partial | Forensics help; runbooks and recovery remain internal. |
| SEC-028 | Availability and DoS resilience | Gap | No clear public support. |
| SEC-029 | Versioning and rollback | Partial | CI/CD testing helps; registry and rollback remain internal. |
| SEC-030 | User transparency and appeal | Gap | Product/UX governance responsibility. |

## Recommended Action Plan

| Phase | Target | Key Actions |
|---|---|---|
| 1. Foundation | Reach 12-15 controls | Build inventory, threat model, data classification, auth, tenant isolation, logging, and secret controls. |
| 2. AI-Specific Protections | Reach 20-23 controls | Add prompt-injection defense, DLP, RAG authorization, output validation, tool allowlists, and cost limits. |
| 3. Stable Production | Reach 24-27 controls | Add continuous red teaming, runtime monitoring, incident response, release gates, and rollback. |
| 4. High Assurance | Reach 28-30 controls | Add audit evidence, resilience testing, transparency, feedback, appeal, and recurring control review. |

## Recommendation

Adopt Straiker if the priority is reducing AI-specific risk in production chatbots, copilots, or agents: prompt injection, data leakage, unsafe tool use, MCP exposure, runtime monitoring, and red-team regression testing. Do not rely on it as the only security control. Combine it with application-layer controls and governance to reach the stable target of **24/30** or higher.

## Sources

- OWASP GenAI Security Project, 2025 Top 10 for LLMs and GenAI Apps: https://genai.owasp.org/llm-top-10/
- OWASP Top 10 for Large Language Model Applications: https://owasp.org/www-project-top-10-for-large-language-model-applications/
- OWASP Agentic AI Security release: https://genai.owasp.org/2025/12/09/owasp-genai-security-project-releases-top-10-risks-and-mitigations-for-agentic-ai-security/
- NIST AI 600-1 Generative AI Profile: https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf
- CSA AI Controls Matrix: https://cloudsecurityalliance.org/artifacts/ai-controls-matrix
- OWASP ASVS: https://owasp.org/www-project-application-security-verification-standard/
- MITRE ATLAS: https://atlas.mitre.org/
- Straiker: https://www.straiker.ai/
- Straiker Discover AI: https://www.straiker.ai/products/discover-ai
- Straiker Ascend AI: https://www.straiker.ai/products/ascend-ai
- Straiker Defend AI: https://www.straiker.ai/products/defend-ai
- Straiker Runtime Guardrails: https://www.straiker.ai/solution/guardrails
