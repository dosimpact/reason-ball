"""Direct official Decisions API transport and strict answer validation."""

import math
import os

import httpx

DECISIONS_URL = "https://api.openai.com/v1/decisions"


def decisions_api_key():
    key = os.getenv("SEC_DECISIONS_API_KEY") or os.getenv("OPENAI_API_KEY", "")
    if not key.startswith("sk-"):
        raise ValueError(
            "Model 3 requires SEC_DECISIONS_API_KEY or OPENAI_API_KEY with an OpenAI API key"
        )
    return key


def probability(value):
    if (
        type(value) not in (int, float)
        or not math.isfinite(value)
        or not 0 <= value <= 1
    ):
        raise ValueError("Invalid Decisions API probability")
    return float(value)


def validate_answers(raw, count, categories, model):
    if (
        not isinstance(raw, dict)
        or raw.get("model") != model
        or not isinstance(raw.get("answers"), list)
    ):
        raise ValueError("Invalid Decisions API response")
    expected = {
        f"c{i}_{kind}": kind
        for i in range(count)
        for kind in ("importance", "category")
    }
    answers = {}
    for answer in raw["answers"]:
        if (
            not isinstance(answer, dict)
            or not isinstance(answer.get("name"), str)
            or answer.get("name") not in expected
            or answer["name"] in answers
        ):
            raise ValueError("Unknown or duplicate Decisions API answer")
        name = answer["name"]
        if answer.get("type") == "refusal":
            answers[name] = answer
            continue
        if expected[name] == "importance":
            if answer.get("type") != "predicate":
                raise ValueError("Importance answer must be predicate")
            probability(answer.get("probability"))
        else:
            if answer.get("type") != "choice" or answer.get("choice") not in categories:
                raise ValueError("Category answer must be an allowed choice")
            probability(answer.get("confidence"))
            values = answer.get("probabilities")
            if not isinstance(values, list) or len(values) != len(categories):
                raise ValueError("Category answer needs every probability")
            distribution = {}
            for value in values:
                if (
                    not isinstance(value, dict)
                    or value.get("value") not in categories
                    or value["value"] in distribution
                ):
                    raise ValueError("Invalid category probability keys")
                distribution[value["value"]] = probability(value.get("probability"))
            if not math.isclose(sum(distribution.values()), 1.0, abs_tol=0.001):
                raise ValueError("Category probabilities must sum to one")
        answers[name] = answer
    if set(answers) != set(expected):
        raise ValueError("Decisions API must answer each question exactly once")
    usage = raw.get("usage", {})
    if not isinstance(usage, dict):
        raise ValueError("Invalid Decisions API usage object")  # noqa: TRY004
    for key in ("input_tokens", "output_tokens", "total_tokens"):
        if key in usage and (type(usage[key]) is not int or usage[key] < 0):
            raise ValueError("Invalid Decisions API token usage")
    return answers


def request_decisions(client, body):
    response = client.post(DECISIONS_URL, json=body)
    if not response.is_success:
        # Never include upstream bodies/headers, credentials, or filing payloads in errors.
        raise ValueError(
            f"OpenAI Decisions API failed with HTTP {response.status_code}"
        )
    try:
        return response.json()
    except ValueError as error:
        raise ValueError("OpenAI Decisions API returned invalid JSON") from error


def decisions_http_client():
    return httpx.Client(
        headers={"Authorization": "Bearer " + decisions_api_key()},
        timeout=httpx.Timeout(180, connect=15),
        follow_redirects=False,
    )
