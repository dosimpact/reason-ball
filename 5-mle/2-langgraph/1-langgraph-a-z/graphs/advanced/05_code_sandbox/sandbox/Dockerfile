# 격리 실행용 Python 이미지.
# - 비루트 유저
# - 추가 의존성 없음 (필요시 numpy 등 화이트리스트 추가)
# 빌드:
#   docker build -t sandbox-python ./sandbox
FROM python:3.11-slim

RUN groupadd -r runner && useradd -r -g runner -m runner

# tmp 외 쓰기 가능 영역 최소화
WORKDIR /home/runner
USER runner

# 컨테이너는 항상 한 번 실행 후 사라짐 (--rm).
# CMD 는 host 에서 -c 로 override.
CMD ["python", "-c", "print('sandbox ready')"]
