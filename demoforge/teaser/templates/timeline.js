"use strict";
const canvas = document.getElementById("canvas");
const headline = document.getElementById("headline");
const caption = document.getElementById("caption");
const marker = document.getElementById("marker");
const identity = document.getElementById("identity");
const evidence = document.getElementById("evidence");
const revision = document.getElementById("revision");
const source = document.getElementById("source");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const motions = [];
function motion(element, keyframes, start, duration, scope) {
  const animation = element.animate(keyframes, {
    duration: 1000, fill: "both", easing: "cubic-bezier(0.22, 1, 0.36, 1)"
  });
  animation.pause();
  motions.push({ animation, start, duration, scope });
}
motion(headline, [
  { transform: "translateY(72px)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }
], 0, 30, "scene");
motion(caption, [
  { transform: "translateY(24px)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }
], 18, 30, "scene");
motion(marker, [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], 12, 42, "scene");
const documentPoses = [
  ["translate(-66px, 38px) rotate(-12deg)", "translate(-102px, 12px) rotate(-8deg)",
    "translate(-128px, -6px) rotate(-8deg)", "translate(-36px, -28px) rotate(0deg)"],
  ["translate(36px, 50px) rotate(8deg)", "translate(70px, 0px) rotate(7deg)",
    "translate(82px, -28px) rotate(8deg)", "translate(26px, -10px) rotate(0deg)"],
  ["translate(0px, 72px) rotate(0deg)", "translate(0px, 0px) rotate(0deg)",
    "translate(-32px, 26px) rotate(-3deg)", "translate(-72px, 14px) rotate(0deg)"]
];
for (const [index, element] of [...document.querySelectorAll("[data-document]")].entries()) {
  const poses = documentPoses[index];
  motion(element, [
    { transform: poses[0], opacity: 0 }, { transform: poses[1], opacity: 1 }
  ], index * 8, 42, "feature");
  motion(element, [{ transform: poses[1] }, { transform: poses[2] }], 180, 48, "feature-move");
  motion(element, [{ transform: poses[2] }, { transform: poses[3] }], 330, 54, "feature-move");
}
motion(document.getElementById("connection"), [
  { transform: "scaleX(0)", opacity: 0 }, { transform: "scaleX(1)", opacity: 1 }
], 346, 38, "feature");
let currentFrame = 0;
let previousLayout = "";
function fitText(element, maxHeight, minimum) {
  element.style.fontSize = "";
  let size = parseFloat(getComputedStyle(element).fontSize);
  while ((element.scrollHeight > maxHeight || element.scrollWidth > element.clientWidth)
    && size > minimum) {
    size -= 1;
    element.style.fontSize = `${size}px`;
  }
  if (element.scrollHeight > maxHeight || element.scrollWidth > element.clientWidth) {
    throw new Error("Approved text exceeds the readable template bounds");
  }
}
window.renderFrame = function renderFrame(frame) {
  if (!Number.isInteger(frame) || frame < 0 || frame >= spec.total_frames) {
    throw new RangeError("Frame must be an integer in [0, 900)");
  }
  currentFrame = frame;
  const sceneIndex = frame < 180 ? 0 : frame < 660 ? 1 : 2;
  const scene = spec.scenes[sceneIndex];
  const localFrame = frame - scene.start_frame;
  const layout = `${sceneIndex}:${matchMedia("(max-width: 799px)").matches}`;
  canvas.className = scene.kind;
  identity.textContent = spec.product_name;
  headline.textContent = sceneIndex === 1 ? scene.text : spec.product_name;
  caption.textContent = scene.text;
  document.getElementById("eyebrow").textContent = sceneIndex === 1
    ? "Repository excerpt" : "From the repository";
  document.getElementById("document-anchor").textContent = scene.evidence_id;
  evidence.textContent = `Documented source / ${scene.evidence_id}`;
  revision.textContent = `Commit ${spec.commit_sha.slice(0, 12)} / Revision ${spec.revision}`;
  source.textContent = spec.repository_url;
  caption.setAttribute("aria-label", scene.text);
  if (layout !== previousLayout) {
    fitText(headline, document.getElementById("headline-mask").clientHeight, 24);
    if (sceneIndex !== 1) fitText(caption, caption.clientHeight, 18);
    fitText(document.getElementById("document-anchor"), 128, 12);
    previousLayout = layout;
  }
  for (const { animation, start, duration, scope } of motions) {
    const position = reducedMotion.matches
      ? (scope === "scene" ? 120 : localFrame < 180 ? 60 : localFrame < 330 ? 228 : 384)
      : localFrame;
    animation.effect.updateTiming({ fill: scope === "feature-move" ? "forwards" : "both" });
    animation.currentTime = scope === "feature-move" && position < start ? -1
      : Math.max(0, Math.min(1, (position - start) / duration)) * 1000;
  }
  canvas.dataset.frame = String(frame);
  canvas.dataset.scene = scene.scene_id;
  const beat = sceneIndex !== 1 ? 0 : localFrame < 180 ? 0 : localFrame < 330 ? 180 : 330;
  const settled = sceneIndex === 1 ? (beat === 0 ? 58 : beat === 180 ? 48 : 54) : 54;
  const sample = reducedMotion.matches ? "reduced" : Math.min(localFrame - beat, settled);
  return { frame, scene_id: scene.scene_id,
    capture_key: `${sceneIndex}:${beat}:${sample}` };
};
function resizePreview() {
  const viewport = document.getElementById("viewport");
  const mobile = matchMedia("(max-width: 799px)").matches;
  const scale = viewport.clientWidth / 1920;
  canvas.style.transform = mobile ? "none" : `scale(${scale})`;
  viewport.style.height = mobile ? "1200px" : `${1080 * scale}px`;
  previousLayout = "";
  window.renderFrame(currentFrame);
}
addEventListener("resize", resizePreview);
reducedMotion.addEventListener("change", () => window.renderFrame(currentFrame));
resizePreview();