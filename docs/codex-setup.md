# Codex Setup

## MCP 서버 관리

이 프로젝트는 `.codex/config.toml`에 프로젝트 범위 MCP 서버를 설정한다.
`codex mcp add`는 기본적으로 글로벌 설정(`~/.codex/config.toml`)을 수정하므로,
프로젝트 로컬 설정은 `.codex/config.toml`을 직접 관리한다.

기준 설정:

```toml
[mcp_servers.pgv-state-mcp]
command = "node"
args = ["packages/pgv-state-mcp/dist/index.js"]
```

### 전체 명령

아래 블록 하나로 로컬 설정 추가, 확인, 글로벌 설정 정리, TUI 확인 방법까지 볼 수 있다.

```bash
# 프로젝트 루트로 이동한다.
cd /Users/studio/workspace/projects/reason-ball

# 로컬 Codex 설정 디렉터리를 만든다.
mkdir -p .codex

# pgv-state-mcp를 프로젝트 로컬 MCP 서버로 등록한다.
# 주의: `codex mcp add ...`는 글로벌 설정을 수정하므로 여기서는 로컬 파일을 직접 관리한다.
# 기존 로컬 설정이 있다면 보존하고, pgv-state-mcp 블록이 없을 때만 뒤에 추가한다.
touch .codex/config.toml
if ! grep -q '^\[mcp_servers\.pgv-state-mcp\]' .codex/config.toml; then
  cat >> .codex/config.toml <<'EOF'

[mcp_servers.pgv-state-mcp]
command = "node"
args = ["packages/pgv-state-mcp/dist/index.js"]
EOF
fi

# 로컬 설정 파일 내용을 확인한다.
cat .codex/config.toml

# 현재 Codex가 인식하는 MCP 서버 목록을 확인한다.
# 이 명령은 로컬/글로벌 출처를 따로 표시하지 않는다.
codex mcp list

# pgv-state-mcp의 최종 해석된 설정을 확인한다.
codex mcp get pgv-state-mcp

# 글로벌 설정에 같은 서버가 남아 있다면 글로벌 파일만 백업 후 정리한다.
# `codex mcp remove pgv-state-mcp`는 현재 로드된 설정을 대상으로 하므로
# 이 프로젝트 안에서 실행하면 로컬 설정을 지울 수 있다.
cp ~/.codex/config.toml ~/.codex/config.toml.bak
perl -0pi -e 's/\n?\[mcp_servers\.pgv-state-mcp\]\ncommand = "node"\nargs = \["packages\/pgv-state-mcp\/dist\/index\.js"\]\n?/\n/s' ~/.codex/config.toml

# 글로벌 정리 후에도 이 프로젝트에서 로컬 설정이 계속 인식되는지 확인한다.
codex mcp get pgv-state-mcp

# Codex TUI 안에서는 아래 명령을 직접 입력해 현재 세션에서 활성화된 MCP 서버와 도구를 확인한다.
# /mcp
```
