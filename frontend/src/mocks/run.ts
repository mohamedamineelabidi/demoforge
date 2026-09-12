import { z } from "zod";

export const LOCAL_RUN_STAGES = Object.freeze([
  "created",
  "ingesting",
  "planning",
  "awaiting_approval",
  "acquiring_footage",
  "storyboarding",
  "rendering",
  "reviewing",
] as const);

export const LOCAL_RUN_OUTCOMES = Object.freeze([
  "complete",
  "failed",
  "cancelled",
] as const);

const localRunStageSchema = z.enum(LOCAL_RUN_STAGES);
const localRunOutcomeSchema = z.enum(LOCAL_RUN_OUTCOMES);

export const localRunStatusSchema = z.strictObject({
  kind: z.literal("local-display-mock"),
  current: z.union([localRunStageSchema, localRunOutcomeSchema]),
  completedStages: z.array(localRunStageSchema).max(LOCAL_RUN_STAGES.length).readonly(),
  attempts: z.strictObject({
    stage: localRunStageSchema,
    transient: z.number().int().min(0).max(3),
    repair: z.number().int().min(0).max(1),
  }).readonly(),
}).superRefine((run, context) => {
  if (new Set(run.completedStages).size !== run.completedStages.length) {
    context.addIssue({
      code: "custom",
      path: ["completedStages"],
      message: "Completed mock stages must be unique.",
    });
  }
  if (run.completedStages.some((stage) => stage === run.current)) {
    context.addIssue({
      code: "custom",
      path: ["completedStages"],
      message: "The current mock stage cannot also be completed.",
    });
  }
}).readonly();

export type RunStage = z.infer<typeof localRunStageSchema>;
export type RunOutcome = z.infer<typeof localRunOutcomeSchema>;
export type RunStatus = z.infer<typeof localRunStatusSchema>;
export type RunState = RunStatus["current"];

export const mockRunStatus: RunStatus = localRunStatusSchema.parse({
  kind: "local-display-mock",
  current: "awaiting_approval",
  completedStages: ["created", "ingesting", "planning"],
  attempts: { stage: "planning", transient: 1, repair: 0 },
});