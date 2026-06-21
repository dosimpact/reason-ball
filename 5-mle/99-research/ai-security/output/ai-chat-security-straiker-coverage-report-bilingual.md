# AI Chat Application Security Requirements and Straiker AI Coverage Report

# AI Chat Application 보안 요구사항 및 Straiker AI 커버리지 보고서

Access date: 2026-06-10  
접근일: 2026-06-10

## Executive Summary / 요약

**EN**  
This report defines **30 security requirements** for building an AI chat application and evaluates how much Straiker AI appears to cover based on public sources.

Recommended stability threshold: an AI chat application should satisfy **at least 24/30 requirements**, with all Critical controls complete and no unmanaged High gaps, before broad production rollout. High-assurance operation should target **28-30/30** with continuous red teaming, monitoring, audit evidence, and lifecycle governance.

Straiker AI appears to cover **12 controls fully**, **12 partially**, and leaves **6 clear gaps**. Weighted score: **18/30** using Full = 1, Partial = 0.5, Gap = 0. It is a strong fit for AI-specific runtime defense, red teaming, agent inventory, MCP/tool security, and forensics, but it does not replace application security engineering or governance.

**KO**  
이 보고서는 AI Chat Application 구축에 필요한 **보안 요구사항 30개**를 정의하고, 공개 자료 기준으로 Straiker AI가 해당 요구사항을 어느 정도 커버하는지 평가한다.

권장 안정화 기준은 광범위한 프로덕션 배포 전 **최소 24/30개 요구사항 충족**, 모든 Critical 통제 완료, 그리고 관리되지 않은 High gap이 없는 상태다. 고신뢰 운영 환경은 지속적 레드팀, 모니터링, 감사 증적, 라이프사이클 거버넌스를 포함해 **28-30/30개** 충족을 목표로 해야 한다.

Straiker AI는 공개 자료 기준 **12개 통제를 완전 커버**, **12개를 부분 커버**, **6개는 명확한 gap**으로 평가된다. Full = 1, Partial = 0.5, Gap = 0 기준 가중 점수는 **18/30**이다. Straiker는 AI 특화 런타임 방어, 레드팀, agent inventory, MCP/tool 보안, 포렌식에는 강하지만, 애플리케이션 보안 엔지니어링과 거버넌스를 대체하지는 않는다.

## Method / 방법

**EN**  
Requirements were derived from OWASP LLM Top 10 2025, OWASP Agentic AI guidance, NIST AI 600-1, CSA AI Controls Matrix, MITRE ATLAS, and OWASP ASVS. Straiker coverage was evaluated from public Straiker product and solution pages only. Vendor performance claims were not independently verified.

**KO**  
요구사항은 OWASP LLM Top 10 2025, OWASP Agentic AI 가이드, NIST AI 600-1, CSA AI Controls Matrix, MITRE ATLAS, OWASP ASVS를 기반으로 도출했다. Straiker 커버리지는 Straiker의 공개 제품 및 솔루션 페이지에 근거해 평가했다. 벤더의 성능 주장은 독립 검증하지 않았다.

## Security Requirement Set / 보안 요구사항 세트

**EN**  
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

**KO**  
총 항목 수: **30개**

| 영역 | 요구사항 ID |
|---|---|
| 거버넌스 및 라이프사이클 | SEC-001 to SEC-005, SEC-029, SEC-030 |
| ID, 접근통제, 격리 | SEC-006 to SEC-009 |
| 프롬프트, 입력, 콘텐츠 보호 | SEC-010 to SEC-013, SEC-019 |
| 데이터, RAG, 출력 안전성 | SEC-014 to SEC-018 |
| Agent, Tool, MCP | SEC-020 to SEC-023 |
| 모니터링, 테스트, 운영 | SEC-024 to SEC-028 |

상세 요구사항은 `requirements/ai-chat-security-controls.md`에 유지한다.

## Maturity and Roadmap / 성숙도 및 로드맵

**EN**

| Level | Required Count | Milestone | Action Items |
|---|---:|---|---|
| L0 Unsafe | 0-7 | Local experiment only | Do not use real users, production data, tools, or external actions. |
| L1 Foundation | 8-15 | Internal prototype | Complete inventory, threat model, auth, basic logging, data rules, and prompt-injection tests. |
| L2 Controlled Pilot | 16-23 | Limited pilot | Add RAG authorization, DLP, output validation, tool allowlists, rate limits, and release gates. |
| L3 Stable Production | 24-27 | Broad production | Complete all Critical controls, most High controls, runtime monitoring, incident response, red teaming, and rollback. |
| L4 High Assurance | 28-30 | Regulated or high-risk use | Add audit evidence, continuous evals, user appeal, transparency, resilience, and lifecycle governance. |

Minimum stable target: **24/30**. If any Critical control is missing, the system should remain at L1 or L2 regardless of count. Any remaining High gap needs compensating controls or explicit risk acceptance.

**KO**

| 레벨 | 필요 항목 수 | 마일스톤 | 액션 아이템 |
|---|---:|---|---|
| L0 Unsafe | 0-7 | 로컬 실험 전용 | 실제 사용자, 프로덕션 데이터, 도구, 외부 액션을 사용하지 않는다. |
| L1 Foundation | 8-15 | 내부 프로토타입 | 인벤토리, 위협 모델, 인증, 기본 로깅, 데이터 규칙, 프롬프트 인젝션 테스트를 완료한다. |
| L2 Controlled Pilot | 16-23 | 제한적 파일럿 | RAG 권한검사, DLP, 출력 검증, tool allowlist, rate limit, release gate를 추가한다. |
| L3 Stable Production | 24-27 | 광범위한 프로덕션 | 모든 Critical 통제와 대부분의 High 통제, 런타임 모니터링, 사고 대응, 레드팀, 롤백을 완료한다. |
| L4 High Assurance | 28-30 | 규제 또는 고위험 사용 | 감사 증적, 지속 평가, 사용자 이의제기, 투명성, 복원력, 라이프사이클 거버넌스를 추가한다. |

최소 안정화 목표는 **24/30**이다. Critical 통제가 하나라도 누락되면 총점과 관계없이 L1 또는 L2에 머물러야 한다. 남은 High gap은 보완통제 또는 명시적 위험수용이 필요하다.

## Straiker AI Research Summary / Straiker AI 리서치 요약

**EN**  
Straiker describes three relevant capabilities:

- **Discover AI**: inventories AI agents, tools, MCP servers, integrations, risky permissions, unsafe connections, and misconfigurations.
- **Ascend AI**: performs continuous, scheduled, on-demand, and CI/CD-triggered AI red teaming across applications, workflows, identities, tools, models, and data.
- **Defend AI**: provides runtime guardrails for prompt injection, jailbreaks, data exfiltration, agent manipulation, tool/MCP risks, unsafe outputs, toxic content, multimodal inputs, alerting, and chain-of-threat forensics.

Based on public documentation, Straiker is most useful after the application has basic engineering controls in place. It can materially improve AI-specific detection, testing, and runtime enforcement, but the product does not appear to own tenant isolation, application authentication, data classification, human approval workflow design, provider resilience, or end-user transparency.

**KO**  
Straiker는 관련 역량을 세 가지로 설명한다.

- **Discover AI**: AI agent, tool, MCP server, integration, 위험 권한, unsafe connection, misconfiguration을 식별하고 inventory화한다.
- **Ascend AI**: application, workflow, identity, tool, model, data 전반에 대해 지속적, 예약형, 온디맨드, CI/CD 트리거 기반 AI red teaming을 수행한다.
- **Defend AI**: prompt injection, jailbreak, data exfiltration, agent manipulation, tool/MCP risk, unsafe output, toxic content, multimodal input, alerting, chain-of-threat forensics에 대한 런타임 guardrail을 제공한다.

공개 문서 기준으로 Straiker는 애플리케이션에 기본 엔지니어링 통제가 구축된 이후 가장 유용하다. AI 특화 탐지, 테스트, 런타임 enforcement를 크게 보강할 수 있지만 tenant isolation, application authentication, data classification, human approval workflow 설계, provider resilience, end-user transparency를 제품이 직접 책임지는 것으로 보기는 어렵다.

## Coverage Matrix / 커버리지 매트릭스

| ID | Requirement / 요구사항 | Coverage | Comment / 설명 |
|---|---|---|---|
| SEC-001 | AI inventory / AI 인벤토리 | Full | Discover AI directly supports inventory and posture visibility. / Discover AI가 inventory 및 posture visibility를 직접 지원한다. |
| SEC-002 | Threat modeling / 위협 모델링 | Partial | Ascend AI helps test risk, but architecture threat modeling remains internal. / Ascend AI가 위험 테스트를 돕지만 아키텍처 위협 모델링은 내부 책임이다. |
| SEC-003 | Data classification / 데이터 분류 | Partial | Defend AI can enforce policies, but classification must be defined internally. / Defend AI가 정책 enforcement를 도울 수 있으나 분류 기준은 내부에서 정의해야 한다. |
| SEC-004 | Supply chain review / 공급망 검토 | Partial | Helps with AI/MCP/tool posture; contracts and vendor due diligence remain internal. / AI/MCP/tool posture에는 도움이 되지만 계약 및 벤더 실사는 내부 책임이다. |
| SEC-005 | Change control / 변경 통제 | Partial | CI/CD testing helps; versioning and rollback need internal process. / CI/CD 테스트는 도움이 되나 versioning 및 rollback은 내부 프로세스가 필요하다. |
| SEC-006 | Authentication / 인증 | Gap | No public evidence of app auth coverage. / 애플리케이션 인증 커버리지에 대한 공개 근거가 없다. |
| SEC-007 | Tenant isolation / 테넌트 격리 | Gap | Must be implemented in app/data architecture. / 앱 및 데이터 아키텍처에서 구현해야 한다. |
| SEC-008 | Least privilege / 최소권한 | Full | Discover AI identifies risky permissions and connections. / Discover AI가 위험 권한과 연결을 식별한다. |
| SEC-009 | Secret management / 시크릿 관리 | Partial | Can detect exfiltration, but not secret lifecycle management. / 유출 탐지는 가능하지만 시크릿 라이프사이클 관리는 별도 필요하다. |
| SEC-010 | Prompt injection defense / 프롬프트 인젝션 방어 | Full | Core Defend AI and Ascend AI fit. / Defend AI와 Ascend AI의 핵심 영역이다. |
| SEC-011 | Jailbreak and abuse detection / jailbreak 및 abuse 탐지 | Full | Core runtime guardrail fit. / 런타임 guardrail의 핵심 영역이다. |
| SEC-012 | File and multimodal input scanning / 파일 및 멀티모달 입력 검사 | Full | Defend AI claims multimodal and file-input threat detection. / Defend AI가 multimodal 및 file-input threat detection을 주장한다. |
| SEC-013 | System prompt leakage / 시스템 프롬프트 유출 | Full | Guardrails page names system prompt leak coverage. / Guardrails 페이지에서 system prompt leak coverage를 언급한다. |
| SEC-014 | Sensitive data leakage / 민감정보 유출 | Full | Defend AI claims PII, PCI, HIPAA, code, and secret exfiltration detection. / Defend AI가 PII, PCI, HIPAA, code, secret exfiltration detection을 주장한다. |
| SEC-015 | RAG authorization / RAG 권한검사 | Partial | Leakage detection helps, but retrieval ACLs must be built. / 유출 탐지는 도움되지만 retrieval ACL은 직접 구현해야 한다. |
| SEC-016 | Vector and memory protection / vector 및 memory 보호 | Partial | Testing may help; vector-store controls are not fully public. / 테스트는 도움이 될 수 있으나 vector-store 통제는 공개 자료로 충분히 확인되지 않는다. |
| SEC-017 | Output validation / 출력 검증 | Partial | Output safety helps; schema validation and encoding remain app controls. / output safety는 도움이 되지만 schema validation과 encoding은 앱 통제다. |
| SEC-018 | Grounding and hallucination controls / grounding 및 hallucination 통제 | Partial | Guardrails mention grounding/hallucinations; factual QA remains app work. / guardrails에서 grounding/hallucination을 언급하지만 factual QA는 앱 책임이다. |
| SEC-019 | Harmful content filtering / 유해 콘텐츠 필터링 | Full | Defend AI claims toxic and policy-violating output protection. / Defend AI가 toxic 및 policy-violating output protection을 주장한다. |
| SEC-020 | Tool/MCP controls / Tool/MCP 통제 | Full | Strong fit through Discover AI and Defend AI. / Discover AI와 Defend AI 모두에 강하게 부합한다. |
| SEC-021 | Human approval / 사람 승인 | Gap | No clear public support for approval workflows. / approval workflow 지원에 대한 명확한 공개 근거가 없다. |
| SEC-022 | Rate, cost, and transaction limits / rate, cost, transaction 제한 | Gap | Platform/application control. / 플랫폼 또는 애플리케이션 통제다. |
| SEC-023 | Agent memory governance / agent memory 거버넌스 | Partial | Agent manipulation coverage helps; lifecycle governance unclear. / agent manipulation 대응은 도움되지만 lifecycle governance는 불명확하다. |
| SEC-024 | Audit logging and traces / 감사 로그 및 trace | Full | Defend AI claims traces, audit logs, and forensics. / Defend AI가 trace, audit log, forensics를 주장한다. |
| SEC-025 | Runtime monitoring / 런타임 모니터링 | Full | Core Defend AI capability. / Defend AI의 핵심 역량이다. |
| SEC-026 | Red teaming and evals / red teaming 및 평가 | Full | Core Ascend AI capability. / Ascend AI의 핵심 역량이다. |
| SEC-027 | Incident response / 사고 대응 | Partial | Forensics help; runbooks and recovery remain internal. / forensics는 도움이 되나 runbook과 recovery는 내부 책임이다. |
| SEC-028 | Availability and DoS resilience / 가용성 및 DoS 복원력 | Gap | No clear public support. / 명확한 공개 지원 근거가 없다. |
| SEC-029 | Versioning and rollback / versioning 및 rollback | Partial | CI/CD testing helps; registry and rollback remain internal. / CI/CD 테스트는 도움이 되나 registry와 rollback은 내부 책임이다. |
| SEC-030 | User transparency and appeal / 사용자 투명성 및 이의제기 | Gap | Product/UX governance responsibility. / 제품 및 UX 거버넌스 책임이다. |

## Recommended Action Plan / 권장 액션 플랜

**EN**

| Phase | Target | Key Actions |
|---|---|---|
| 1. Foundation | Reach 12-15 controls | Build inventory, threat model, data classification, auth, tenant isolation, logging, and secret controls. |
| 2. AI-Specific Protections | Reach 20-23 controls | Add prompt-injection defense, DLP, RAG authorization, output validation, tool allowlists, and cost limits. |
| 3. Stable Production | Reach 24-27 controls | Add continuous red teaming, runtime monitoring, incident response, release gates, and rollback. |
| 4. High Assurance | Reach 28-30 controls | Add audit evidence, resilience testing, transparency, feedback, appeal, and recurring control review. |

**KO**

| 단계 | 목표 | 주요 액션 |
|---|---|---|
| 1. Foundation | 12-15개 통제 달성 | inventory, threat model, data classification, auth, tenant isolation, logging, secret control을 구축한다. |
| 2. AI-Specific Protections | 20-23개 통제 달성 | prompt-injection defense, DLP, RAG authorization, output validation, tool allowlist, cost limit을 추가한다. |
| 3. Stable Production | 24-27개 통제 달성 | continuous red teaming, runtime monitoring, incident response, release gate, rollback을 추가한다. |
| 4. High Assurance | 28-30개 통제 달성 | audit evidence, resilience testing, transparency, feedback, appeal, recurring control review를 추가한다. |

## Recommendation / 권고

**EN**  
Adopt Straiker if the priority is reducing AI-specific risk in production chatbots, copilots, or agents: prompt injection, data leakage, unsafe tool use, MCP exposure, runtime monitoring, and red-team regression testing. Do not rely on it as the only security control. Combine it with application-layer controls and governance to reach the stable target of **24/30** or higher.

**KO**  
프로덕션 chatbot, copilot, agent에서 prompt injection, data leakage, unsafe tool use, MCP exposure, runtime monitoring, red-team regression testing 같은 AI 특화 위험을 줄이는 것이 우선순위라면 Straiker 도입을 검토할 가치가 있다. 단일 보안 통제로 의존해서는 안 된다. 안정화 목표인 **24/30개 이상**을 달성하려면 애플리케이션 계층 통제와 거버넌스를 함께 구축해야 한다.

## Sources / 출처

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
