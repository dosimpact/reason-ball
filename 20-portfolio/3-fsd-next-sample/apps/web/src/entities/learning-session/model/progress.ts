import { z } from "zod";

const dayMilliseconds = 86_400_000;
const dateSchema = z.iso.date();
export const activityDaySchema = z.object({
  date: dateSchema,
  minutes: z.number().int().nonnegative(),
  activeSeconds: z.number().int().nonnegative().optional(),
  messages: z.number().int().nonnegative(),
  missionsStarted: z.number().int().nonnegative(),
  missionsCompleted: z.number().int().nonnegative(),
}).strict();
export type ActivityDay = z.infer<typeof activityDaySchema>;
export const progressSourceSchema = z.object({
  today: dateSchema,
  days: z.array(activityDaySchema),
  expressionCount: z.number().int().nonnegative(),
  source: z.enum(["account", "demo"]),
}).strict();
export type ProgressSource = z.infer<typeof progressSourceSchema>;

export function shiftLearningDate(date: string, offset: number) {
  dateSchema.parse(date);
  if (!Number.isInteger(offset)) throw new Error("Date offset must be an integer");
  return new Date(Date.parse(`${date}T00:00:00Z`) + offset * dayMilliseconds).toISOString().slice(0, 10);
}

function hasActivity(day: ActivityDay) {
  return (day.activeSeconds ?? day.minutes * 60) + day.messages + day.missionsStarted + day.missionsCompleted > 0;
}

export function summarizeLearningProgress(input: ProgressSource) {
  const source = progressSourceSchema.parse(input);
  const days = new Map<string, ActivityDay>();
  for (const day of source.days) {
    if (days.has(day.date)) throw new Error("Duplicate learning date");
    days.set(day.date, day);
  }
  const activeDates = source.days.filter((day) => day.date <= source.today && hasActivity(day)).map((day) => day.date).sort();
  let longestStreak = 0;
  let currentRun = 0;
  let previous: string | undefined;
  for (const date of activeDates) {
    currentRun = previous && shiftLearningDate(previous, 1) === date ? currentRun + 1 : 1;
    longestStreak = Math.max(longestStreak, currentRun);
    previous = date;
  }
  const streak = previous === source.today || previous === shiftLearningDate(source.today, -1) ? currentRun : 0;
  const recentDays = Array.from({ length: 7 }, (_, index) => {
    const date = shiftLearningDate(source.today, index - 6);
    return days.get(date) ?? { date, minutes: 0, messages: 0, missionsStarted: 0, missionsCompleted: 0 };
  });
  return { source: source.source, today: source.today, recentDays, streak, longestStreak,
    recentMinutes: recentDays.reduce((total, day) => total + day.minutes, 0), expressionCount: source.expressionCount };
}

export function demoProgressSource(today: string): ProgressSource {
  // Explicit demo history, not a claim that the signed-in learner studied.
  return { today, source: "demo", expressionCount: 0,
    days: [5, 5, 5, 5, 5, 5, 12].map((minutes, index) => ({
      date: shiftLearningDate(today, index - 6), minutes, messages: 1, missionsStarted: 0, missionsCompleted: 0,
    })) };
}
