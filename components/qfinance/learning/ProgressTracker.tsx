"use client";

import { useEffect } from "react";
import { markVisited } from "@/lib/qfinance-progress";

/** Renders nothing — mounted once on a chapter page to record that the
 * learner has opened it, for the timeline's "visited" indicator. */
export default function ProgressTracker({ slug }: { slug: string }) {
  useEffect(() => {
    markVisited(slug);
  }, [slug]);

  return null;
}
