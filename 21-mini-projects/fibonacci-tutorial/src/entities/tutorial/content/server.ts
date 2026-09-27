import "server-only";
import type { TutorialContent } from "./types";
import { impulseTheory } from "./units/impulse-theory";
import { waveCounting } from "./units/wave-counting";
import { rulesTheory } from "./units/rules-theory";
import { rulesPractice } from "./units/rules-practice";
import { waveThreeContent } from "./units/wave-three";
import { fibonacciTheory } from "./units/fibonacci-theory";
import { fibonacciPractice } from "./units/fibonacci-practice";
import { tradeReview } from "./units/trade-review";
import { marketLab } from "./units/market-lab";

const contents: TutorialContent[] = [impulseTheory, waveCounting, rulesTheory, rulesPractice, waveThreeContent, fibonacciTheory, fibonacciPractice, tradeReview, marketLab];
export function getTutorialContent(unitId: string): TutorialContent | undefined { return contents.find((content) => content.summary.id === unitId); }
