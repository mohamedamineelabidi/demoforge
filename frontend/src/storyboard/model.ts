import { lintBrief } from "../entry/schemas";
import { editScene, timeline, type Project, type Scene } from "../model";

export const STORYBOARD_FPS = 30;
export const STORYBOARD_TARGET_FRAMES = 900;
export const CAPTION_MAX_LENGTH = 160;
export const CLIP_REFERENCE_MAX_LENGTH = 500;

export function timeline30fps(scenes: Scene[]) {
  const sequence = timeline(scenes).map(({ start, end, ...scene }) => ({
    ...scene,
    start_frame: start,
    end_frame: end,
  }));
  const totalFrames = sequence.at(-1)?.end_frame ?? 0;
  return {
    fps: STORYBOARD_FPS,
    targetFrames: STORYBOARD_TARGET_FRAMES,
    totalFrames,
    matchesTarget: totalFrames === STORYBOARD_TARGET_FRAMES,
    scenes: sequence,
  };
}

export function captionErrors(caption: string): string[] {
  return [
    ...(caption.length > CAPTION_MAX_LENGTH
      ? [`Keep the caption to ${CAPTION_MAX_LENGTH} characters.`] : []),
    ...lintBrief(caption).map((issue) => issue.message),
  ];
}

export function editCaption(project: Project, sceneId: string, caption: string): Project {
  const errors = captionErrors(caption);
  if (errors.length) throw new Error(errors.join(" "));
  return editScene(project, sceneId, { caption });
}

export function setSceneEndFrame(project: Project, sceneId: string, endFrame: number): Project {
  const scene = timeline30fps(project.scenes).scenes.find((item) => item.id === sceneId);
  if (!scene) throw new Error("Scene not found");
  const frames = endFrame - scene.start_frame;
  if (!Number.isInteger(frames) || frames < 1 || frames > 1800) {
    throw new Error("End frame must give this scene a duration of 1 to 1800 whole frames.");
  }
  return editScene(project, sceneId, { frames });
}

export type SceneChange = {
  sceneId: string;
  captionChanged: boolean;
  structureChanged: boolean;
};

function structure(scene: ReturnType<typeof timeline30fps>["scenes"][number], index: number) {
  return [index, scene.title, scene.frames, scene.start_frame, scene.end_frame,
    scene.trimIn, scene.zoom, scene.claimId, scene.highlight ?? "none", scene.footageClipRef ?? ""];
}

export function compareStoryboard(scenes: Scene[], reviewedScenes?: Scene[]) {
  const current = timeline30fps(scenes).scenes;
  const reviewed = timeline30fps(reviewedScenes ?? []).scenes;
  const changes: SceneChange[] = current.map((scene, index) => {
    const priorIndex = reviewed.findIndex((item) => item.id === scene.id);
    const prior = reviewed[priorIndex];
    return {
      sceneId: scene.id,
      captionChanged: !!prior && scene.caption !== prior.caption,
      structureChanged: reviewedScenes !== undefined && (!prior ||
        JSON.stringify(structure(scene, index)) !== JSON.stringify(structure(prior, priorIndex))),
    };
  });
  const removedSceneIds = reviewed.filter((scene) => !scenes.some((item) => item.id === scene.id))
    .map((scene) => scene.id);
  return {
    hasBaseline: reviewedScenes !== undefined,
    changed: removedSceneIds.length > 0 || changes.some((scene) =>
      scene.captionChanged || scene.structureChanged),
    scenes: changes,
    removedSceneIds,
  };
}