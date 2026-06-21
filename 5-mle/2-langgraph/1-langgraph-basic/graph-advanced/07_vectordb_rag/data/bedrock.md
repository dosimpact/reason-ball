# Amazon Bedrock

Amazon Bedrock is a fully managed service that offers foundation models from
leading AI companies (Anthropic, Meta, Cohere, Mistral, Amazon) via a single API.

## 특징

- **Application Inference Profile**: 부서/팀별 비용/쿼터 분리
- **Cross-region inference**: 가용성 확보
- **Converse API**: provider-agnostic chat 인터페이스
- **Tool use / structured output** 지원

## Claude on Bedrock

`anthropic.claude-sonnet-4-20250514-v1:0` 같은 모델 ID 로 호출.
프로덕션은 inference profile ARN 을 통해 호출하는 것이 권장됨 (모니터링 / 비용 태깅 용이).
