import { redirect } from "next/navigation";

// The Beginner Journey moved to a chapter-based architecture under
// /qfinance/learn/beginner/ (see the QFinance phased-implementation spec,
// Section 18 — "Beginner Journey Major Redesign"). This route is kept as a
// redirect so any existing links/bookmarks to the old single-page SketchFlow
// version still land somewhere useful, instead of 404ing.
//
// The old SketchFlow implementation itself (CuriosityModule, SketchCanvas,
// DrawPath, MovingDot, BuyScene, BeginnerJourneyC1) has been moved to
// /_archive/qfinance-sketchflow/ (excluded from tsc/eslint via tsconfig.json
// and eslint.config.mjs) — kept on disk per the spec's guidance not to
// delete it outright given the current direction change, but no longer part
// of the active build or type-checked/linted.
export default function LegacyBeginnerRedirect() {
  redirect("/qfinance/learn/beginner");
}
