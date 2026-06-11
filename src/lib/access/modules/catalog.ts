import { LICENSE_FEATURES, type LicenseFeature } from "@/lib/license/types";
import type { ModuleDefinition, ModuleId } from "../types";
import { MODULE_REGISTRY, listLicensedModules } from "./registry";

/** Licensed modules whose `licenseFeature` is missing from LICENSE_FEATURES. */
export function assertRegistryLicenseFeatures(): string[] {
  const allowed = new Set<string>(LICENSE_FEATURES);
  const errors: string[] = [];
  for (const mod of Object.values(MODULE_REGISTRY)) {
    if (mod.licenseFeature && !allowed.has(mod.licenseFeature)) {
      errors.push(`Module "${mod.id}" references unknown license feature "${mod.licenseFeature}"`);
    }
  }
  return errors;
}

export function licenseFeatureForModule(moduleId: ModuleId): LicenseFeature | undefined {
  return MODULE_REGISTRY[moduleId]?.licenseFeature;
}

export function moduleIdsForLicenseFeature(feature: LicenseFeature): ModuleId[] {
  return Object.values(MODULE_REGISTRY)
    .filter((m) => m.licenseFeature === feature)
    .map((m) => m.id);
}

export function licensedModuleCatalog(): ModuleDefinition[] {
  return listLicensedModules();
}
