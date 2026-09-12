import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createProject } from "../model";
import { parseCatalog } from "../evidence/imports";
import catalogFixture from "../../test-fixtures/catalog.json";
import { ApprovalReview } from "./ApprovalReview";
import { approvalSchema } from "./schema";

describe("approval review surface", () => {
  it("keeps the ordered subjects local, blocked and empty without imported evidence or output", () => {
    const onDecision = vi.fn();
    const markup = renderToStaticMarkup(createElement(ApprovalReview, {
      project: createProject("Review"), drafts: [], onDecision,
    }));
    expect(markup.indexOf('aria-label="Claims review"')).toBeLessThan(markup.indexOf('aria-label="Storyboard review"'));
    expect(markup.indexOf('aria-label="Storyboard review"')).toBeLessThan(markup.indexOf('aria-label="Final output review"'));
    expect(markup).toContain("Not sent, local draft");
    expect(markup).toContain("No imported claims catalog");
    expect(markup).toContain("No final MP4 selected");
    expect(markup).not.toContain("<video");
    expect(markup.match(/class="approval-approve" disabled=""/g)).toHaveLength(3);
    expect(markup.match(/class="approval-reject" disabled=""/g)).toHaveLength(3);
    expect(onDecision).not.toHaveBeenCalled();
  });
  it("renders imported text safely, actual frame ranges and stale local records", () => {
    const project = createProject("Review");
    const catalog = parseCatalog(JSON.stringify(catalogFixture));
    catalog.claims[0].text = "<img src=x onerror=alert(1)>";
    const stale = approvalSchema.parse({ schema_version: 1, approval_id: "local:old",
      run_id: `local:${project.id}`, subject_type: "claims", subject_id: "old-catalog",
      subject_revision: 1, subject_sha256: "a".repeat(64), actor_id: "Operator",
      decision: "approved", decided_at: "2026-09-12T00:00:00Z", note: "Earlier review" });
    const markup = renderToStaticMarkup(createElement(ApprovalReview, {
      project, catalog, drafts: [stale], onDecision: vi.fn(), disabled: true,
    }));
    expect(markup).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(markup).toContain("[0, 180)");
    expect(markup).toContain("30 fps");
    expect(markup).toContain("old-catalog");
    expect(markup).toContain("Stale / local only");
    expect(markup).toContain("Earlier review");
    expect(markup).toContain("SHA-256 pending");
    expect(markup).not.toContain("blob:");
  });
});