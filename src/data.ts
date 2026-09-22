/**
 * Business-card content. Edit these values — everything the API serves
 * derives from here.
 */

/** When my professional experience started (Ape Unit, Mar 2012). */
export const CAREER_START = new Date("2012-03-01T00:00:00Z");

/**
 * Whole years of professional experience since CAREER_START, computed at
 * request time so it never goes stale. `now` is injectable for tests.
 */
export function yearsOfExperience(now: Date = new Date()): number {
  let years = now.getUTCFullYear() - CAREER_START.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - CAREER_START.getUTCMonth();
  // Not yet reached the anniversary month/day this year -> subtract one.
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < CAREER_START.getUTCDate())) {
    years -= 1;
  }
  return years;
}

export const profile = {
  name: "Max Dörfler",
  handle: "muxe",
  role: "Backend Developer",
  tagline: "Backend developer who thinks a business card should return JSON.",
  bio: "Software engineer, ~10 years in. Started on the JavaScript/Node.js full stack, now mostly write Kotlin backends (Quarkus, Spring Boot) and run the AWS they live on. Currently spending a lot of time on agentic engineering — figuring out how AI agents actually fit into day-to-day dev work instead of just the demos.",
  location: "Germany",
  employer: {
    name: "WAPP GmbH",
    url: "https://wapp.gmbh/",
  },
  skills: [
    "Kotlin",
    "Node.js",
    "Agentic Engineering",
    "AWS",
    "Team Leadership",
  ],
  education: {
    school: "Freie Universität Berlin",
    degree: "B.Sc. Computer Science",
    period: "2006–2011",
  },
  // Recruiters: this field is the answer to your next question.
  availability: "Employed and happy — not looking for new roles right now.",
} as const;

/**
 * Work history, newest first. Served via GET /experience. Written plainly on
 * purpose — no "spearheading", no "high-performing", no LinkedIn lingo.
 */
export interface Job {
  company: string;
  role: string;
  period: string;
  location: string;
  summary: string;
  highlights: string[];
  stack: string[];
}

export const experience: Job[] = [
  {
    company: "WAPP GmbH",
    role: "Full Stack Engineer",
    period: "Nov 2024 – present",
    location: "Bielefeld, Germany · Hybrid",
    summary:
      "Full-stack work, cloud, and engineering practices for client products, owning delivery end to end.",
    highlights: [
      "One of the first here to actually put agentic engineering to work — planning, designing, and prototyping AI agent workflows for client projects.",
      "Built an internal dev tool to package and share AI \"agent skills\" across projects, so teams stop reinventing them.",
      "Brought automated testing and CI/CD to legacy codebases that had neither.",
      "Design and run scalable Kotlin backends (Quarkus, Spring Boot) and the AWS infra under them.",
    ],
    stack: ["Kotlin", "Quarkus", "Spring Boot", "AWS", "TypeScript"],
  },
  {
    company: "Yara International",
    role: "Lead Software Engineer",
    period: "Oct 2021 – Mar 2024",
    location: "Remote",
    summary:
      "Led a software engineering team while staying hands-on in the architecture and the codebase.",
    highlights: [
      "Built up and mentored the team, and set up the processes that made delivery more predictable.",
      "Kept the team culture healthy — retention stayed high and people actually worked well across functions.",
      "Steered the architecture of the core products while still writing code.",
    ],
    stack: ["Node.js", "JavaScript", "AWS", "Team Leadership"],
  },
  {
    company: "Yara International",
    role: "Back End Developer",
    period: "Jul 2018 – Oct 2021",
    location: "Berlin, Germany · Hybrid",
    summary:
      "Built backend services in an international, agile setup across distributed teams.",
    highlights: [
      "Pushed for the boring-but-important stuff: real PR reviews, automated tests, continuous deployment.",
      "Ran and took part in the usual agile ceremonies, and shared knowledge across engineering chapters.",
      "Wrote reliable, high-throughput microservices in Node.js.",
    ],
    stack: ["Node.js", "NestJS", "PostgreSQL", "JavaScript", "Microservices"],
  },
  {
    company: "Ape Unit GmbH",
    role: "Software Engineer",
    period: "Mar 2012 – Jun 2018",
    location: "Berlin, Germany · On-site",
    summary:
      "Owned client projects end to end — from picking the stack to shipping — solo and with the team.",
    highlights: [
      "Chose the tech, designed the architecture, and did the estimates for upcoming milestones.",
      "Worked closely with designers and frontend devs to turn wireframes into working apps.",
      "Over six years, moved my core stack from legacy PHP to Node.js and Vue.js.",
    ],
    stack: ["Node.js", "Vue.js", "JavaScript", "PHP"],
  },
];

/**
 * The /now page — what I'm actually focused on right now. Keep it current;
 * that's the whole point (see nownownow.com for the convention).
 */
export const now = {
  updated: "2026-09",
  focus: [
    "Figuring out how AI actually changes this job — day to day, not in the think-pieces.",
    "Keeping an eye on where the developer landscape is heading. The job is shifting fast and I don't want to be caught flat-footed.",
    "Thinking about how developers stay motivated and avoid burning out when the ground keeps moving under us. I don't have this one solved.",
  ],
  note: "This is a /now page — an honest snapshot of what's on my mind, not a résumé. See nownownow.com for the idea.",
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
  url?: string;
  note?: string;
}

export const projects: Project[] = [
  {
    name: "muxe.org",
    description: "This website — a REST API business card built on zero-dependency node:http.",
    url: "https://muxe.org",
  },
  {
    name: "Agent skills toolkit",
    description:
      "An internal dev tool for packaging and sharing AI \"agent skills\" across projects.",
    note: "Internal / client work — no public link.",
  },
];
