// This file is a bridge for backward compatibility
// Re-export everything from the new i18n module
export * from "@/i18n";

// Optional: Add deprecation warning in development
if (process.env.NODE_ENV === "development") {
  console.warn(
    "⚠️ @/lib/i18n.tsx is deprecated. Please update imports to use @/i18n instead."
  );
}