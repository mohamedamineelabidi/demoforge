import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BRIEF_LIMITS, MARKETING_WORDS } from "../entry/schemas";
import { RepositoryEntry } from "./RepositoryEntry";
import { prepareRepositoryDraft } from "./validation";

const repository = "https://github.com/mohamedamineelabidi/realestate-rag";

describe("repository-only draft input", () => {
  it("normalizes a .git URL and derives a name without inventing a brief", () => {
    expect(prepareRepositoryDraft(` ${repository}.git/ `, "", "")).toEqual({
      success: true,
      input: { name: "realestate-rag", repository, brief: "" },
    });
  });

  it.each([
    "",
    "github.com/owner/repo",
    "http://github.com/owner/repo",
    "https://gitlab.com/owner/repo",
    "https://github.com.evil.test/owner/repo",
    "https://github.com/owner/repo/tree/main",
    "https://github.com/owner/repo#readme",
    "https://github.com/owner/repo?tab=readme",
    "https://user:password@github.com/owner/repo",
    "https://github.com:443/owner/repo",
    "prefix https://github.com/owner/repo suffix",
    "https://github.com/owner/repo\nhttps://evil.test",
    "https://github.com/owner/%72epo",
    "https://github.com/owner/..",
  ])("rejects the entire invalid URL: %s", (url) => {
    expect(prepareRepositoryDraft(url, "", "")).toMatchObject({
      success: false,
      errors: { url: expect.any(String) },
    });
  });

  it("trims the brief and forwards the full normalized SHA reference", () => {
    const commit = "ABCDEF0123456789".repeat(2) + "ABCDEF01";
    expect(prepareRepositoryDraft(repository, " Filter listings. ", ` ${commit} `))
      .toEqual({
        success: true,
        input: {
          name: "realestate-rag",
          repository: `${repository}@${commit.toLowerCase()}`,
          brief: "Filter listings.",
        },
      });
  });

  it.each(["main", "abc1234", "g".repeat(40), "a".repeat(41)])(
    "rejects an invalid commit: %s",
    (commit) => {
      expect(prepareRepositoryDraft(repository, "", commit)).toMatchObject({
        success: false,
        errors: { commit: "A commit SHA has exactly 40 hexadecimal characters." },
      });
    },
  );

  it.each(["Filter\u2014listings", ...MARKETING_WORDS])(
    "rejects unapproved brief wording: %s",
    (brief) => {
      expect(prepareRepositoryDraft(repository, brief, "")).toMatchObject({
        success: false,
        errors: { brief: expect.any(String) },
      });
    },
  );

  it("bounds the optional brief using the existing description limit", () => {
    expect(prepareRepositoryDraft(repository, "a".repeat(BRIEF_LIMITS.changed), "")
      .success).toBe(true);
    expect(prepareRepositoryDraft(repository, "a".repeat(BRIEF_LIMITS.changed + 1), ""))
      .toMatchObject({ success: false, errors: { brief: expect.any(String) } });
  });

  it("returns all field errors together for first-invalid focus", () => {
    expect(prepareRepositoryDraft("bad", "seamless", "main")).toMatchObject({
      success: false,
      errors: {
        url: expect.any(String),
        brief: expect.any(String),
        commit: expect.any(String),
      },
    });
  });
});

describe("RepositoryEntry static rendering", () => {
  it("renders a source-only form without fetching or creating on initial input", () => {
    const onCreate = vi.fn();
    const markup = renderToStaticMarkup(createElement(RepositoryEntry, {
      onCreate,
      onCancel: vi.fn(),
      initialRepository: repository,
    }));
    expect(markup).toContain("Source-only draft");
    expect(markup).toContain("No repository fetched. No footage or generation yet.");
    expect(markup).toContain("Create source draft");
    expect(markup).toContain("realestate-rag");
    expect(markup.match(/type="url"/g)).toHaveLength(1);
    expect(markup).not.toMatch(/type="file"|<video|<iframe|<img|<a\s|Generated video|Start run/);
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("does not derive a project name from a partial initial URL match", () => {
    const markup = renderToStaticMarkup(createElement(RepositoryEntry, {
      onCreate: vi.fn(),
      onCancel: vi.fn(),
      initialRepository: `${repository}/tree/main`,
    }));
    expect(markup).toContain("Project name pending");
  });

  it("disables the form when the parent is unavailable", () => {
    const markup = renderToStaticMarkup(createElement(RepositoryEntry, {
      onCreate: vi.fn(),
      onCancel: vi.fn(),
      disabled: true,
    }));
    expect(markup).toMatch(/<fieldset[^>]*disabled=""/);
    expect(markup).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
  });
});