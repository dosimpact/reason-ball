

# 1, mcp-server distill 버전 만들기  

/Users/dodo/workspace/projects/harness-engineering-3/.bkit-codex/packages/mcp-server 을 분석한다.  

목적 :
- 1, bkit mcp server 에서 특정 툴을 (제거 대상 참고) 제거한다.
- 2, typescript로 변환한다.
- 3, 출력 디렉터리 /Users/dodo/workspace/projects/harness-engineering-3/ckit-mcp-server
- 4, ckit 라는 이름으로 리브랜딩 한다.  


## MCP Tools (16) 전체 대상

The MCP server provides 16 tools via JSON-RPC 2.0 over STDIO with **zero external dependencies**:

| Tool | Category | Purpose |
|------|----------|---------|
| `bkit_init` | Session | Initialize session, detect level, load PDCA status, compact summary |
| `bkit_analyze_prompt` | Intent | Detect language, match triggers, score ambiguity (8 languages) |
| `bkit_get_status` | PDCA | Retrieve current PDCA status with recommendations (supports recovery mode) |
| `bkit_pre_write_check` | PDCA | Pre-write compliance check (design document existence) |
| `bkit_post_write` | PDCA | Post-write guidance (gap analysis suggestions) |
| `bkit_complete_phase` | PDCA | Mark phase complete, validate transition, advance task chain |
| `bkit_pdca_plan` | Template | Generate plan document template with level-specific sections and task chain |
| `bkit_pdca_design` | Template | Generate design template (Starter/Dynamic/Enterprise variants) |
| `bkit_pdca_analyze` | Template | Generate gap analysis template |
| `bkit_pdca_next` | PDCA | Recommend next PDCA action based on current state |
| `bkit_classify_task` | Utility | Classify task size (quick_fix / minor_change / feature / major_feature) |
| `bkit_detect_level` | Utility | Detect project level from directory structure |
| `bkit_select_template` | Utility | Select template by phase and level |
| `bkit_check_deliverables` | Utility | Verify phase deliverables exist |
| `bkit_memory_read` | Memory | Read session memory |
| `bkit_memory_write` | Memory | Write session memory |


## MCP Tools  


| Tool | Category | Purpose |
|------|----------|---------|
| `bkit_init` | Session | Initialize session, detect level, load PDCA status, compact summary |
| `bkit_analyze_prompt` | Intent | Detect language, match triggers, score ambiguity (8 languages) |
| `bkit_get_status` | PDCA | Retrieve current PDCA status with recommendations (supports recovery mode) |
| `bkit_pre_write_check` | PDCA | Pre-write compliance check (design document existence) |
| `bkit_post_write` | PDCA | Post-write guidance (gap analysis suggestions) |
| `bkit_complete_phase` | PDCA | Mark phase complete, validate transition, advance task chain |
| `bkit_pdca_plan` | Template | Generate plan document template with level-specific sections and task chain |
| `bkit_pdca_design` | Template | Generate design template (Starter/Dynamic/Enterprise variants) |
| `bkit_pdca_analyze` | Template | Generate gap analysis template |
| `bkit_pdca_next` | PDCA | Recommend next PDCA action based on current state |
| `bkit_select_template` | Utility | Select template by phase and level |
| `bkit_memory_read` | Memory | Read session memory |
| `bkit_memory_write` | Memory | Write session memory |


제거 대상  
| `bkit_classify_task` | Utility | Classify task size (quick_fix / minor_change / feature / major_feature) |
| `bkit_detect_level` | Utility | Detect project level from directory structure |
| `bkit_check_deliverables` | Utility | Verify phase deliverables exist |
