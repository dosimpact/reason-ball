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
      return "Error: Only numeric expressions allowed.";
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

export const TOOLS = [getCurrentTime, calculate];
