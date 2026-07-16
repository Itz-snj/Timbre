/**
 * Single source of truth for identity shown in the UI.
 *
 * The footer links are a hard requirement of the assignment's submission
 * guidelines (ai_rules.md §4, Phase 7) — fill these in before submitting.
 */
export const site = {
  name: "Timbre",
  tagline: "The note that talks back.",
  description:
    "Sketch on a canvas or write a document, then record straight into it. The voice note is the note — any length, any language. Export the whole thing, audio and all, as one portable file.",

  author: {
    name: "Suman Jain",
    github: "https://github.com/Itz-snj",
    linkedin: "https://www.linkedin.com/in/suman-naresh-jain",
  },

  /** Marketing copy for the landing page — edit here, not in JSX. */
  landing: {
    announcement: "New — live collaboration and .vnote export are live.",
    heroHeadline: "The note that talks back.",
    heroSub:
      "The recording is the note — any length, any language. Sketch around it, or write around it.",
    heroReassurance: "Google sign-in · 5 minutes of recording per account · free",
    closingHeadline: "Start talking your notes.",
    closingSub: "Google sign-in. 5 minutes of recording. No credit card.",
    closingReassurance: "Free to use · private audio · one-file export",
  },
} as const;
