import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createProject } from "../model";
import { parseCatalog } from "../evidence/imports";
import catalogFixture from "../../test-fixtures/catalog.json";
import { MotionPreview } from "./MotionPreview";
import { localAssetUrl, sourceTime } from "./media";

describe("motion preview contract", () => {
  it("blocks unknown and exhausted source bounds without presenting a held video frame", () => {
    const project = createProject("Bounded footage");
    project.scenes[0].trimIn = 300;
    for (const duration of [undefined, NaN, Infinity, 0, 10]) {
      const markup = renderToStaticMarkup(createElement(MotionPreview, { project,
        media: { url: "blob:local/test", name: "clip.mp4", permitted: true, reviewed: true, duration } }));
      expect(markup).toContain("Preview blocked");
      expect(markup).toContain("visibility:hidden");
      expect(markup).toMatch(/aria-label="Play motion preview"[^>]*disabled/);
    }
  });

  it("rejects arbitrary demo imagery and never recreates highlight masks", () => {
    const project = createProject("Demo", true);
    project.scenes[0].highlight = "spotlight";
    for (const demoImage of ["https://example.com/image.png", "//example.com/image.png",
      "/other.png", "/taskroom.png?remote=1", "blob:local/still"]) {
      const markup = renderToStaticMarkup(createElement(MotionPreview, { project, demoImage }));
      expect(markup).not.toContain("<img");
      expect(markup).not.toContain("<canvas");
      expect(markup).not.toContain("mask");
      expect(markup).toContain("Not a product demonstration or generated video.");
    }
  });

  it("preserves long caption source text and explicitly reports the composition limit", () => {
    const project = createProject("Source typography");
    project.scenes[0].caption = "Literal source text ".repeat(5);
    const markup = renderToStaticMarkup(createElement(MotionPreview, { project }));
    expect(markup).toContain(project.scenes[0].caption);
    expect(markup).toContain("Caption exceeds 60 characters");
    expect(markup).toContain("source text is unchanged");
  });

  it("shows the real name, draft state and missing evidence without fabricated UI", () => {
    const project = createProject("Actual product");
    const markup = renderToStaticMarkup(createElement(MotionPreview, { project }));
    for (const label of ["Actual product", "Motion study", "Local draft", "Not rendered",
      "Conceptual source motion graphics", "No linked evidence", "The starting point",
      "Scene title / editable label", 'aria-label="Play motion preview"',
      'aria-label="Restart motion preview"', 'aria-label="Preview frame"']) {
      expect(markup).toContain(label);
    }
    expect(markup).not.toContain("<video");
    expect(markup).not.toContain("<img");
    expect(markup).not.toContain("<iframe");
  });

  it("never mounts unpermitted, unreviewed or remote video", () => {
    for (const media of [
      { url: "blob:local/test", name: "private.mp4", permitted: false, reviewed: true },
      { url: "blob:local/test", name: "private.mp4", permitted: true, reviewed: false },
      { url: "https://example.com/video.mp4", name: "remote.mp4", permitted: true, reviewed: true },
    ]) {
      const markup = renderToStaticMarkup(createElement(MotionPreview, { project: createProject("Private"), media }));
      expect(markup).not.toContain("<video");
      expect(markup).not.toContain(media.url);
    }
    const markup = renderToStaticMarkup(createElement(MotionPreview, {
      project: createProject("Reviewed"),
      media: { url: "blob:local/test", name: "reviewed.mp4", permitted: true, reviewed: true },
    }));
    expect(markup).toContain("<video");
    expect(markup).toContain('src="blob:local/test"');
    expect(markup).not.toContain("autoPlay");
  });

  it("only mounts a local demo still for a demo project and labels it as still imagery", () => {
    const demoImage = "/taskroom.png";
    const render = (demo: boolean) => renderToStaticMarkup(createElement(MotionPreview,
      { project: createProject("Demo", demo), demoImage }));
    expect(render(false)).not.toContain("<img");
    expect(render(true)).toContain('src="/taskroom.png"');
    expect(render(true)).toContain("Demo still / Not footage");
  });

  it("renders literal local copy and reported evidence without fetching catalog URLs", () => {
    const project = createProject("Source project");
    const catalog = parseCatalog(JSON.stringify(catalogFixture));
    project.scenes[0].claimId = catalog.claims[0].claim_id;
    project.scenes[0].caption = "<script>draft text</script>";
    catalog.assets = ["https://untrusted.example/asset.png"];
    catalog.evidence[0].source = "https://untrusted.example/source";
    const markup = renderToStaticMarkup(createElement(MotionPreview, { project, catalog }));
    expect(markup).toContain("&lt;script&gt;draft text&lt;/script&gt;");
    expect(markup).toContain(`Reported status: ${catalog.claims[0].verification_status}`);
    expect(markup).toContain(catalog.claims[0].evidence_ids[0]);
    expect(markup).not.toContain('href="https:');
    expect(markup).not.toContain('src="https:');
    expect(markup).not.toContain("Approved");
  });
});

describe("local source guards", () => {
  it("rejects external, protocol-relative, encoded and script URL tricks", () => {
    for (const url of ["https://site/a", "//site/a", "/\\site/a", "javascript:alert(1)",
      "data:video/mp4,a", "/%2fsite/a", "/%5csite/a", " /asset.png", "/asset\n.png"]) {
      expect(localAssetUrl(url)).toBeNull();
    }
    expect(localAssetUrl("/taskroom.png")).toBe("/taskroom.png");
    expect(localAssetUrl("blob:local/file")).toBe("blob:local/file");
  });

  it("rejects unknown or out-of-range source times instead of freezing the final frame", () => {
    expect(sourceTime(45, 10)).toBe(1.5);
    expect(sourceTime(300, 10)).toBeNull();
    for (const value of [NaN, Infinity, -1, 0.5]) expect(sourceTime(value, 10)).toBeNull();
    expect(sourceTime(0)).toBeNull();
    for (const duration of [NaN, Infinity, 0]) expect(sourceTime(0, duration)).toBeNull();
  });
});