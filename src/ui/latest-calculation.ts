import type { Overview } from "./workspace-types";

export function latestCalculation(runs: Overview["calculations"]) {
  return runs.reduce<Overview["calculations"][number] | undefined>(
    (latest, run) => {
      if (!latest) return run;
      const saved = run.created_at ?? "";
      const previous = latest.created_at ?? "";
      return saved > previous ||
        (saved === previous && run.tax_year > latest.tax_year)
        ? run
        : latest;
    },
    undefined,
  );
}
