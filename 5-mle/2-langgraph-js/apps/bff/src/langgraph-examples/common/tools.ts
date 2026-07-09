import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const getCurrentTime = tool(
  () => {
    const now = new Date();
    const kst = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(now);
    return `${kst.replace("T", " ")} KST`;
  },
  {
    name: "get_current_time",
    description: "현재 시간(KST)을 반환합니다.",
    schema: z.object({})
  }
);

export const calculate = tool(
  ({ expression }) => {
    const allowed = /^[0-9+\-*/.() ]+$/;
    if (!allowed.test(expression)) {
      return "Error: Only numeric expressions with +, -, *, /, (, ) are allowed.";
    }

    try {
      return String(Function(`"use strict"; return (${expression});`)());
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
  {
    name: "calculate",
    description: "숫자와 +-*/(). 만 포함된 수학 식을 계산합니다.",
    schema: z.object({
      expression: z.string().describe("계산할 수식")
    })
  }
);

export const lookupInfo = tool(
  ({ topic }) => {
    const knowledge: Record<string, string> = {
      langgraph:
        "LangGraph is a library for building stateful, multi-actor applications with LLMs. It extends LangChain with cyclic graph support.",
      bedrock:
        "Amazon Bedrock is a fully managed service that offers foundation models from leading AI companies through a single API.",
      fastapi:
        "FastAPI is a modern, fast web framework for building APIs with Python based on standard Python type hints."
    };
    const key = topic.toLowerCase().trim();
    for (const [name, value] of Object.entries(knowledge)) {
      if (key.includes(name)) {
        return value;
      }
    }
    return `No specific information found for '${topic}'.`;
  },
  {
    name: "lookup_info",
    description: "주어진 토픽에 대한 간단한 정보를 반환합니다.",
    schema: z.object({
      topic: z.string().describe("조회할 주제")
    })
  }
);

export const TOOLS = [getCurrentTime, calculate, lookupInfo];
