import { z } from "zod";

const sceneSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(80),
  caption: z.string().max(160),
  frames: z.number().int().min(1).max(1800),
  trimIn: z.number().int().min(0).max(108000),
  zoom: z.number().min(1).max(1.5),
  claimId: z.string(),
});
const scenesSchema = z
  .array(sceneSchema)
  .min(1)
  .max(12)
  .refine(
    (scenes) => new Set(scenes.map((scene) => scene.id)).size === scenes.length,
  );
const snapshotSchema = z.object({
  scenes: scenesSchema,
  accent: z.enum(["#176B5B", "#315DA8", "#A23F58"]),
});
const projectSchema = snapshotSchema.extend({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  brief: z.string().max(2000),
  repository: z.string().max(500),
  demo: z.boolean(),
  revision: z.number().int().positive(),
  updatedAt: z.string().datetime(),
  past: z.array(snapshotSchema).max(50),
  future: z.array(snapshotSchema).max(50),
});
export type Scene = z.infer<typeof sceneSchema>;
export type Project = z.infer<typeof projectSchema>;
export const STORAGE_KEY = "demoforge.local-drafts.v1";

export function createProject(name: string, demo = false): Project {
  return projectSchema.parse({
    id: crypto.randomUUID(),
    name,
    demo,
    brief: demo
      ? "Show the completed-task filter, from the full list to the filtered result."
      : "",
    repository: "",
    revision: 1,
    updatedAt: new Date().toISOString(),
    accent: "#176B5B",
    past: [],
    future: [],
    scenes: [
      {
        id: crypto.randomUUID(),
        title: "The starting point",
        caption: demo ? "Everything in one place." : "",
        frames: 180,
        trimIn: 0,
        zoom: 1,
        claimId: "",
      },
      {
        id: crypto.randomUUID(),
        title: "One clear action",
        caption: demo ? "Filter completed tasks." : "",
        frames: 480,
        trimIn: 180,
        zoom: 1,
        claimId: demo ? "DEMO-CLM-001" : "",
      },
      {
        id: crypto.randomUUID(),
        title: "The visible result",
        caption: demo ? "Just the completed work." : "",
        frames: 240,
        trimIn: 660,
        zoom: 1,
        claimId: demo ? "DEMO-CLM-001" : "",
      },
    ],
  });
}

function snapshot(project: Project) {
  return { scenes: project.scenes, accent: project.accent };
}

export function updateProject(
  project: Project,
  patch: Partial<
    Pick<Project, "name" | "brief" | "repository" | "accent" | "scenes">
  >,
): Project {
  return projectSchema.parse({
    ...project,
    ...patch,
    revision: project.revision + 1,
    updatedAt: new Date().toISOString(),
    past: [...project.past, snapshot(project)].slice(-50),
    future: [],
  });
}

export function editScene(
  project: Project,
  sceneId: string,
  patch: Partial<Scene>,
): Project {
  if (!project.scenes.some((scene) => scene.id === sceneId))
    throw new Error("Scene not found");
  return updateProject(project, {
    scenes: project.scenes.map((scene) =>
      scene.id === sceneId
        ? sceneSchema.parse({ ...scene, ...patch, id: scene.id })
        : scene,
    ),
  });
}

export function moveScene(
  project: Project,
  sceneId: string,
  direction: -1 | 1,
): Project {
  const index = project.scenes.findIndex((scene) => scene.id === sceneId);
  const destination = index + direction;
  if (index < 0 || destination < 0 || destination >= project.scenes.length)
    return project;
  const scenes = [...project.scenes];
  [scenes[index], scenes[destination]] = [scenes[destination], scenes[index]];
  return updateProject(project, { scenes });
}

export function undo(project: Project): Project {
  const previous = project.past.at(-1);
  if (!previous) return project;
  return {
    ...project,
    ...previous,
    revision: project.revision + 1,
    updatedAt: new Date().toISOString(),
    past: project.past.slice(0, -1),
    future: [snapshot(project), ...project.future].slice(0, 50),
  };
}

export function redo(project: Project): Project {
  const next = project.future[0];
  if (!next) return project;
  return {
    ...project,
    ...next,
    revision: project.revision + 1,
    updatedAt: new Date().toISOString(),
    past: [...project.past, snapshot(project)].slice(-50),
    future: project.future.slice(1),
  };
}

export function timeline(scenes: Scene[]) {
  let frame = 0;
  return scenes.map((scene) => {
    const start = frame;
    frame += scene.frames;
    return { ...scene, start, end: frame };
  });
}

export function parseProjects(raw: string): Project[] {
  return z
    .object({
      version: z.literal(1),
      projects: z.array(projectSchema).max(100),
    })
    .parse(JSON.parse(raw)).projects;
}

export function timecode(frame: number) {
  return `${String(Math.floor(frame / 1800)).padStart(2, "0")}:${String(Math.floor(frame / 30) % 60).padStart(2, "0")}:${String(frame % 30).padStart(2, "0")}`;
}
