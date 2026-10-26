"""프로젝트 루트 설정과 백엔드 비밀을 서버에서만 읽습니다."""

from pathlib import Path

from dotenv import load_dotenv

BACKEND = Path(__file__).resolve().parents[1]
PROJECT = BACKEND.parent
load_dotenv(PROJECT / ".env", override=False)
load_dotenv(BACKEND / ".env", override=False)
