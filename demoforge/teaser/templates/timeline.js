"use strict";
const canvas = document.getElementById("canvas");
const headline = document.getElementById("headline");
const caption = document.getElementById("caption");
const revealed = document.getElementById("revealed");
const unrevealed = document.getElementById("unrevealed");
const marker = document.getElementById("marker");
const identity = document.getElementById("identity");
const evidence = document.getElementById("evidence");
const revision = document.getElementById("revision");
const source = document.getElementById("source");
const entrance = headline.animate([
  { transform: "translateY(110%)" }, { transform: "translateY(0)" }
], { duration: 1000, fill: "both", easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
const underline = marker.animate([
  { transform: "scaleX(0)" }, { transform: "scaleX(1)" }
], { duration: 1000, fill: "both", easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
entrance.pause();
underline.pause();
const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
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
  const shotStart = frame < 180 ? 0 : frame < 360 ? 180 : frame < 510 ? 360
    : frame < 660 ? 510 : frame < 810 ? 660 : 810;
  const finalHold = shotStart === 810;
  const localFrame = finalHold ? 120 : frame - shotStart;
  const dark = shotStart === 180 || shotStart === 510 || finalHold;
  const center = shotStart === 360 || shotStart === 510 || sceneIndex === 2;
  const layout = `${shotStart}:${matchMedia("(max-width: 799px)").matches}`;
  canvas.className = [dark ? "dark" : "", center ? "center" : "",
    sceneIndex === 1 ? "feature" : ""].join(" ");
  identity.textContent = spec.product_name;
  headline.textContent = sceneIndex === 1 ? scene.text : spec.product_name;
  evidence.textContent = `Documented source / ${scene.evidence_id}`;
  revision.textContent = `Commit ${spec.commit_sha.slice(0, 12)} / Revision ${spec.revision}`;
  source.textContent = spec.repository_url;
  caption.setAttribute("aria-label", scene.text);
  if (layout !== previousLayout) {
    revealed.textContent = scene.text;
    unrevealed.textContent = "";
    fitText(headline, document.getElementById("headline-mask").clientHeight, 24);
    if (sceneIndex !== 1) fitText(caption, caption.clientHeight, 18);
    previousLayout = layout;
  }
  const characters = Array.from(segmenter.segment(scene.text), item => item.segment);
  const count = Math.max(0, Math.min(characters.length, localFrame - 16));
  revealed.textContent = characters.slice(0, count).join("");
  unrevealed.textContent = characters.slice(count).join("");
  entrance.currentTime = Math.min(localFrame, 24) / 24 * 1000;
  underline.currentTime = Math.min(localFrame, 36) / 36 * 1000;
  canvas.dataset.frame = String(frame);
  canvas.dataset.scene = scene.scene_id;
  const settled = sceneIndex === 1 ? 36 : Math.max(36, 16 + characters.length);
  return { frame, scene_id: scene.scene_id,
    capture_key: `${shotStart}:${Math.min(localFrame, settled)}` };
};
function resizePreview() {
  const viewport = document.getElementById("viewport");
  const mobile = matchMedia("(max-width: 799px)").matches;
  const scale = viewport.clientWidth / 1920;
  canvas.style.transform = mobile ? "none" : `scale(${scale})`;
  viewport.style.height = mobile ? "1000px" : `${1080 * scale}px`;
  previousLayout = "";
  window.renderFrame(currentFrame);
}
addEventListener("resize", resizePreview);
resizePreview();