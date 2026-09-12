import { describe, expect, it } from "vitest";
import { parseCatalog, parseQualityReport, readImport, reportAssociation } from "./imports";
import catalog from "../../test-fixtures/catalog.json";
import report from "../../test-fixtures/quality.json";

describe("backend artifact imports", () => {
  it("accepts serialized catalog and quality contracts", () => {
    expect(parseCatalog(JSON.stringify(catalog))).toEqual(catalog);
    expect(parseQualityReport(JSON.stringify(report))).toEqual(report);
  });
  it("requires nullable fields, timezone-bearing timestamps and safe integers", () => {
    const { license: omittedLicense, ...repository } = catalog.repository;
    expect(omittedLicense).toBeNull();
    expect(() => parseCatalog(JSON.stringify({ ...catalog, repository }))).toThrow();
    for (const acquired_at of ["2026-09-12T00:00:00", "not-a-time"]) {
      expect(() => parseCatalog(JSON.stringify({ ...catalog, repository: { ...catalog.repository, acquired_at } }))).toThrow();
    }
    for (const revision of [0, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => parseCatalog(JSON.stringify({ ...catalog, revision }))).toThrow();
    }
    const { measurement: omittedMeasurement, ...check } = report.checks[0];
    expect(omittedMeasurement).toBeNull();
    expect(() => parseQualityReport(JSON.stringify({ ...report, checks: [check] }))).toThrow();
  });
  it("accepts supported observation and attestation claims without treating them as approved", () => {
    for (const kind of ["observation", "attestation"]) {
      const value = { ...catalog,
        evidence: [{ ...catalog.evidence[0], kind, observation_id: kind === "observation" ? "observation-1" : null, attestation_id: kind === "attestation" ? "attestation-1" : null }],
        claims: [{ ...catalog.claims[0], verification_status: kind === "observation" ? "runtime_observed" : "user_attested" }],
      };
      expect(parseCatalog(JSON.stringify(value)).claims).toEqual(value.claims);
    }
    expect(parseQualityReport(JSON.stringify({ ...report, gate: "ask_user", questions: ["Confirm the source?"] })).gate).toBe("ask_user");
  });
  it("applies contract defaults and rejects oversized collections", () => {
    const { evidence, claims, assets, files, ...minimal } = catalog;
    expect([evidence.length, claims.length, assets.length, files.length]).toEqual([1, 1, 0, 0]);
    expect(parseCatalog(JSON.stringify(minimal)).evidence).toEqual([]);
    expect(() => parseCatalog(JSON.stringify({ ...catalog, assets: Array(2001).fill("asset") }))).toThrow();
    expect(() => parseQualityReport(JSON.stringify({ ...report, warnings: Array(2001).fill("warning") }))).toThrow();
  });
  it("rejects malformed, unknown-version and extra-field inputs without quoting content", () => {
    for (const value of ["secret malformed input", JSON.stringify({ ...catalog, schema_version: 2 }), JSON.stringify({ ...catalog, secret: "private-value" })]) {
      expect(() => parseCatalog(value)).toThrow();
      try { parseCatalog(value); } catch (error) { expect(String(error)).not.toContain("private-value"); }
    }
  });
  it("rejects invalid hashes, ranges, missing observation and duplicate IDs", () => {
    for (const patch of [{ content_sha256: "bad" }, { line_end: 0 }, { line_start: 4, line_end: 2 }, { line_end: null }, { kind: "observation", observation_id: null }]) {
      expect(() => parseCatalog(JSON.stringify({ ...catalog, evidence: [{ ...catalog.evidence[0], ...patch }] }))).toThrow();
    }
    expect(() => parseCatalog(JSON.stringify({ ...catalog, evidence: [...catalog.evidence, ...catalog.evidence] }))).toThrow();
  });
  it("rejects dangling claim and repository metadata references", () => {
    expect(() => parseCatalog(JSON.stringify({ ...catalog, claims: [{ ...catalog.claims[0], evidence_ids: ["missing"] }] }))).toThrow();
    expect(() => parseCatalog(JSON.stringify({ ...catalog, repository: { ...catalog.repository, metadata_evidence_ids: ["missing"] } }))).toThrow();
  });
  it("requires status-specific support and matching repository revision", () => {
    for (const verification_status of ["runtime_observed", "user_attested"]) {
      expect(() => parseCatalog(JSON.stringify({ ...catalog, claims: [{ ...catalog.claims[0], verification_status }] }))).toThrow();
    }
    expect(() => parseCatalog(JSON.stringify({ ...catalog, evidence: [{ ...catalog.evidence[0], revision: "b".repeat(40) }] }))).toThrow();
  });
  it("rejects path escapes and unscanned file catalogs", () => {
    const file = { path: "README.md", classification: "readme", size_bytes: 12, content_sha256: "c".repeat(64), scan_status: "clean", exclusion_reason: null };
    for (const path of ["../private", "C:/private", "/root", "foo\\bar", "https://host/file"]) {
      expect(() => parseCatalog(JSON.stringify({ ...catalog, files: [{ ...file, path }] }))).toThrow();
    }
    expect(() => parseCatalog(JSON.stringify({ ...catalog, files: [{ ...file, scan_status: "not_scanned" }] }))).toThrow();
  });
  it("rejects passing reports with blocked required checks and empty ask_user reports", () => {
    for (const status of ["fail", "not_run"]) {
      expect(() => parseQualityReport(JSON.stringify({ ...report, gate: "pass", checks: [{ ...report.checks[0], status }] }))).toThrow();
    }
    expect(() => parseQualityReport(JSON.stringify({ ...report, gate: "ask_user" }))).toThrow();
    expect(() => parseQualityReport(JSON.stringify({ ...report, checks: [...report.checks, ...report.checks] }))).toThrow();
  });
  it("rejects secret measurement fields including nested objects", () => {
    for (const measurement of [{ token: "private" }, { stats: { password: "private" } }]) {
      expect(() => parseQualityReport(JSON.stringify({ ...report, checks: [{ ...report.checks[0], measurement }] }))).toThrow();
    }
  });
  it("associates reports by exact catalog ID/revision, never by local draft revision", () => {
    expect(reportAssociation(report, catalog)).toBe("matching");
    expect(reportAssociation({ ...report, subject_revision: 2 }, catalog)).toBe("stale");
    expect(reportAssociation({ ...report, subject_id: "elsewhere" }, catalog)).toBe("unassociated");
    expect(reportAssociation(report, undefined)).toBe("unassociated");
  });
  it("bounds uploads before reading and rejects oversized UTF-8 text", async () => {
    const file = { size: 2_000_001, text: () => { throw new Error("must not read"); } };
    await expect(readImport(file, "catalog")).rejects.toThrow("2 MB");
    expect(() => parseCatalog("é".repeat(1_000_001))).toThrow("2 MB");
  });
});