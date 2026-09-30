# Hello Qdrant with n8n workflow

이 n8n 워크플로우에 대해 설명해드리겠습니다:

1. **워크플로우 목적**
- IMDB 상위 1000개 영화 데이터를 Qdrant 벡터 데이터베이스에 저장하는 워크플로우입니다.
- 영화 설명을 임베딩하여 벡터화된 형태로 저장합니다.

2. **노드별 설명**:

- `When clicking 'Test workflow'`: 수동으로 워크플로우를 시작하는 트리거입니다.

- `GitHub`: 
  - GitHub 저장소(n8n_demo)에서 'Top_1000_IMDB_movies.csv' 파일을 가져옵니다.

- `Extract from File`: 
  - CSV 파일에서 데이터를 추출합니다.

- `Limit`:
  - 처리할 데이터를 30개로 제한합니다.

- `Embeddings OpenAI`:
  - OpenAI의 'text-embedding-3-small' 모델을 사용하여 텍스트를 벡터로 변환합니다.

- `Default Data Loader`:
  - 영화 데이터를 구조화하여 다음 메타데이터와 함께 로드합니다:
    - movie_name: 영화 제목
    - movie_release_date: 개봉 연도
    - movie_description: 영화 설명

- `Token Splitter`:
  - 긴 텍스트를 적절한 크기로 분할합니다.

- `Qdrant Vector Store`:
  - 생성된 벡터와 메타데이터를 Qdrant 데이터베이스의 'imdb' 컬렉션에 저장합니다.

3. **데이터 흐름**:
GitHub → CSV 추출 → 데이터 제한 → 벡터 변환 → Qdrant 저장

이 워크플로우를 통해 영화 데이터를 벡터 데이터베이스에 저장하면, 나중에 유사한 영화 검색이나 추천 시스템 구축 등에 활용할 수 있습니다.

---


이 n8n 워크플로우는 영화 추천 챗봇을 구현한 것입니다. 각 구성요소를 상세히 설명해드리겠습니다:

1. **워크플로우 목적**
- 사용자와 대화를 통해 영화를 추천해주는 AI 챗봇 시스템입니다.
- 벡터 데이터베이스를 활용하여 유사한 영화를 찾아 추천합니다.

2. **주요 노드 설명**:

- `When chat message received`:
  - 사용자로부터 채팅 메시지를 받으면 워크플로우가 시작됩니다.

- `OpenAI Chat Model`:
  - OpenAI의 언어 모델을 사용하여 사용자와의 대화를 처리합니다.

- `Window Buffer Memory`:
  - 대화 컨텍스트를 유지하기 위한 메모리 시스템입니다.
  - 이전 대화 내용을 기억하여 연속적인 대화가 가능하게 합니다.

- `Call n8n Workflow Tool`:
  - 영화 추천을 위한 특별한 도구입니다.
  - 입력 스키마:
    - positive_example: 사용자가 선호하는 영화 설명
    - negative_example: 사용자가 선호하지 않는 영화 설명
  - 다른 워크플로우(a58HZKwcOy7lmz56)를 호출하여 실제 추천을 수행합니다.

- `AI Agent`:
  - 전체 시스템을 조율하는 에이전트입니다.
  - 시스템 메시지: "벡터 데이터베이스를 사용하는 영화 추천 도구입니다. 데이터베이스에서 반환된 상위 3개의 영화 추천을 제공하되, 추천 점수는 사용자에게 보여주지 않습니다."

3. **작동 방식**:
1. 사용자가 메시지를 보냄
2. AI 에이전트가 메시지를 이해하고 처리
3. 필요한 경우 벡터 데이터베이스를 검색하여 영화 추천
4. OpenAI 모델을 통해 자연스러운 응답 생성
5. Window Buffer Memory로 대화 맥락 유지

이 시스템은 사용자의 선호도를 이해하고, 벡터 데이터베이스를 활용하여 개인화된 영화 추천을 제공할 수 있습니다.

---


이 n8n 워크플로우는 영화 추천 시스템의 핵심 기능을 담당하는 워크플로우입니다. 상세히 설명해드리겠습니다:

1. **워크플로우 목적**
- 사용자의 선호도와 비선호도를 바탕으로 Qdrant 벡터 데이터베이스에서 영화를 추천하는 시스템입니다.
- 다른 워크플로우에서 호출되어 사용됩니다.

2. **주요 노드 설명**:

- `Execute Workflow Trigger`:
  - 다른 워크플로우에서 이 워크플로우를 호출할 때의 시작점입니다.
  - 입력으로 'positive_example'(좋아하는 영화 설명)과 'negative_example'(싫어하는 영화 설명)을 받습니다.

- `Embedding Recommendation Request with Open AI`:
  - OpenAI API를 사용하여 positive_example을 벡터로 변환합니다.
  - text-embedding-3-small 모델을 사용합니다.

- `Embedding Anti-Recommendation Request with Open AI`:
  - OpenAI API를 사용하여 negative_example을 벡터로 변환합니다.
  - 마찬가지로 text-embedding-3-small 모델을 사용합니다.

- `Extracting Embedding` & `Extracting Embedding1`:
  - API 응답에서 생성된 임베딩 벡터를 추출합니다.

- `Merge`:
  - 긍정 및 부정 벡터를 하나의 데이터 스트림으로 결합합니다.

- `Calling Qdrant Recommendation API`:
  - Qdrant API에 추천 요청을 보냅니다.
  - 긍정/부정 벡터를 기반으로 추천 영화를 검색합니다.
  - 'average_vector' 전략을 사용하여 상위 3개 영화를 반환합니다.

- `Split Out1` & `Split Out`:
  - API 응답에서 포인트 ID와 결과를 추출합니다.

- `Retrieving Recommended Movies Meta Data`:
  - 추천된 영화 ID를 사용하여 해당 영화의 메타데이터를 가져옵니다.

- `Merge1`:
  - 영화 점수 정보와 메타데이터를 결합합니다.

- `Selecting Fields Relevant for Agent`:
  - 추천 점수, 영화 설명, 영화 제목, 출시 연도 등 필요한 필드를 선택합니다.

- `Aggregate`:
  - 모든 추천 결과를 하나의 응답으로 집계합니다.

3. **데이터 흐름**:
1. 워크플로우 시작 → 사용자 입력 받기
2. 선호도/비선호도 텍스트 → OpenAI 임베딩 변환
3. 임베딩 벡터 → Qdrant 추천 API 호출
4. 추천된 영화 ID → 영화 메타데이터 검색
5. 데이터 가공 → 최종 추천 결과 반환

4. **사용 예시**:
- 입력값: positive_example="romantic comedy", negative_example="horror bloody movie"
- 결과: 로맨틱 코미디 장르의 영화 중에서 공포/피 관련 요소가 적은 영화 3개를 추천해 줍니다.

이 워크플로우는 앞서 살펴본 챗봇 시스템의 백엔드 역할을 하며, 사용자와 대화하는 에이전트가 이 워크플로우를 호출하여 영화 추천 결과를 얻고 사용자에게 제공합니다.
