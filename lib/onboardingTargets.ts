// Single source of truth for DOM ids that the onboarding tour points at.
// Consumers:
//   - Onboarding tour steps (drives the spotlight / tooltip)
//   - VideoEditor render tree (applied as `id={TOUR_TARGETS.x}` on the target
//     element). The DOM stays `id=...` — only the *string value* is centralized
//     so that renaming, deletion, or typos surface as TypeScript errors
//     instead of a silently broken tour.
//
// When adding a new step to the tour, add an entry here first.
export const TOUR_TARGETS = {
  preview: 'preview-container',
  timeline: 'timeline-container',
  subtitleButton: 'subtitle-tool-button',
  propertiesButton: 'properties-tool-button',
  bgmButton: 'bgm-tool-button',
  exportButton: 'export-button',
} as const;

export type TourTargetKey = keyof typeof TOUR_TARGETS;
export type TourTargetId = (typeof TOUR_TARGETS)[TourTargetKey];
