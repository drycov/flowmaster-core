import { describe, expect, it } from "vitest";
import { LICENSE_FEATURES } from "@/lib/license/types";
import {
  assertRegistryLicenseFeatures,
  licenseFeatureForModule,
  moduleIdsForLicenseFeature,
} from "./catalog";
import { listLicensedModules } from "./registry";

describe("module license catalog", () => {
  it("maps every licensed module to a known LICENSE_FEATURES key", () => {
    expect(assertRegistryLicenseFeatures()).toEqual([]);
  });

  it("covers each license feature with at least one module", () => {
    const covered = new Set(
      listLicensedModules().map((m) => m.licenseFeature).filter(Boolean),
    );
    for (const feature of LICENSE_FEATURES) {
      expect(covered.has(feature), `missing module for license feature "${feature}"`).toBe(true);
    }
  });

  it("resolvers round-trip module ↔ feature", () => {
    expect(licenseFeatureForModule("office")).toBe("office");
    expect(moduleIdsForLicenseFeature("office")).toContain("office");
    expect(moduleIdsForLicenseFeature("monitoring")).toContain("monitoring");
  });
});
