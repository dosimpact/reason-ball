# AI Agents Course Examples

이 저장소는 LangChain / LangGraph / OpenAI API 예제를 연습하는 코드 모음입니다.  
처음엔 아래 순서대로 진행하면 됩니다.

## 1) Python 버전 확인

- Python 3.10 이상 권장
- 터미널에서 확인:

```bash
python --version
python3 --version
```

## 2) 가상환경(virtualenv) 만들기

- 프로젝트 폴더로 이동:

```bash
cd /Users/dodo/workspace/projects/red-blood-brain/14-lectures/ai-agents-course
```

- virtualenv 설치 (한 번만):

```bash
# 최신 pip 사용 권장
python -m pip install --upgrade pip
python -m pip install virtualenv
```

- 가상환경 생성:

```bash
# 기본(현재 python으로 virtualenv 생성)
virtualenv .venv

# 특정 버전 지정
virtualenv -p python3.13 .venv
virtualenv -p /usr/local/bin/python3.13 .venv

```

- virtualenv는 `-p`로 Python 실행파일을 직접 지정해서 생성할 버전/인터프리터를 결정합니다.

- 설치한 가상환경 안의 pip로 패키지 설치:

```bash
./.venv/bin/pip install -r requirements.txt
```

- 가상환경 활성화:

```bash
# macOS / Linux
source .venv/bin/activate

# Windows (PowerShell)
# .venv\Scripts\Activate.ps1
```

- (선택) pip 업그레이드:

```bash
pip install --upgrade pip
```

## 3) 라이브러리 설치

```bash
pip install -r requirements.txt
```

## 4) 환경 변수(.env) 설정

프로젝트 루트에 `.env` 파일을 만들고 아래처럼 작성합니다.

```
OPENAI_API_KEY=sk-...
TAVILY_API_KEY=tvly-...
```

- `OPENAI_API_KEY`는 OpenAI 키
- `TAVILY_API_KEY`는 검색 도구(Tavily) 키

## 5) 예제 실행

```bash
python simple_agent.py
python simple_agent_hum_in_loop.py
python simple_agent_lngraph.py
python simple_agent_lngraph_tools.py
streamlit run finance_agent.py
```

`finance_agent.py`는 Streamlit UI를 띄우며, 브라우저에서 CSV 업로드 후 분석 결과를 확인합니다.

## 6) 자주 하는 실수

- `ModuleNotFoundError`:
  - 가상환경이 활성화되지 않았거나 `pip install`이 안 됐을 때 발생
- API 에러:
  - `.env` 파일에 키를 정확히 입력했는지 확인
  - 키가 유효한지 확인
- `python`이 `python3`인지 모를 때:
  - `virtualenv -p python3 .venv` / `./.venv/bin/pip install -r requirements.txt`로 실행

## 7) 예제 파일 설명

- `simple_agent.py`  
  기본적으로 메시지 이력 기반의 간단한 LLM 에이전트 예제

- `simple_agent_hum_in_loop.py`  
  LangGraph에서 툴 호출 동작을 확인하는 예제

  ```mermaid
  flowchart TD
    Start([entry: bot]) --> bot[bot]
    bot -->|직접 답변| END([END])
    bot -->|tool_calls 존재| tools[tools]
    tools --> bot
  ```

- `simple_agent_lngraph.py`  
  LangGraph의 최소 동작 구조

  ```mermaid
  flowchart TD
    Start([entry: bot]) --> bot[bot]
    bot --> END([END])
  ```

- `simple_agent_lngraph_tools.py`  
  LangGraph + Tool + Memory 예제

  ```mermaid
  flowchart TD
    Start([entry: bot]) --> bot[bot]
    bot -->|도구 없음| END([END])
    bot -->|도구 사용 필요| tools[tools]
    tools --> bot
  ```

- `finance_agent.py`  
  CSV 기반 재무 분석 파이프라인 + Streamlit UI 예제

  ```mermaid
  flowchart TD
    Start([entry: gather_financials]) --> gather[gather_financials]
    gather --> analyze[analyze_data]
    analyze --> research[research_competitors]
    research --> compare[compare_performance]

    compare -->|revision <= max_revisions| feedback[collect_feedback]
    compare -->|revision > max_revisions| END([END])
    compare --> write[write_report]

    feedback --> critique[research_critique]
    critique --> compare
  ```

## 8) 실행 종료 + 가상환경 비활성화

```bash
deactivate
```
