/**
 * Business-card content. Edit these values — everything the API serves
 * derives from here.
 */

export const profile = {
  name: "Max Dörfler",
  handle: "muxe",
  role: "Backend Developer",
  bio: "Backend developer who thinks a personal website should also be a REST API.",
  location: "Germany",
  employer: {
    name: "WAPP GmbH",
    url: "https://wapp.gmbh/",
  },
  // Recruiters: this field is the answer to your next question.
  availability: "Employed and happy — not looking for new roles right now.",
} as const;

/**
 * Email is split into parts so naive scrapers that pattern-match on
 * `user@domain` don't harvest it, while a human reading the JSON can
 * reassemble it trivially. Only ever exposed via GET /contact.
 */
export const email = {
  user: "max.doerfler",
  domain: "gmail.com",
} as const;

/** External profiles reachable via redirect routes (GET /<key> -> 302). */
export const socials: Record<string, string> = {
  github: "https://github.com/muxe",
  linkedin: "https://www.linkedin.com/in/max-d%C3%B6rfler-1a3687168/",
};

/**
 * Reaction counters exposed via GET /reactions and POST /reactions/:key.
 *
 * A closed vocabulary on purpose: the public write endpoint accepts ONLY these
 * keys, so there is zero free-text surface for abuse. Adding a reaction means
 * adding a key here AND a matching row + CHECK in a new dbmate migration —
 * the two must stay in sync.
 */
export const REACTION_KEYS = ["rocket", "whale", "coffee", "thumbsup"] as const;

export type ReactionKey = (typeof REACTION_KEYS)[number];

/** Runtime membership test that also narrows the type to ReactionKey. */
export function isReactionKey(value: string): value is ReactionKey {
  return (REACTION_KEYS as readonly string[]).includes(value);
}

export interface Project {
  name: string;
  description: string;
  url: string;
}

export const projects: Project[] = [
  {
    name: "muxe.org",
    description: "This website — a REST API business card built on zero-dependency node:http.",
    url: "https://muxe.org",
  },
  // TODO: add real projects
];
