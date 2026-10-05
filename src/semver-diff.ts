/**
 * Tiny semantic-version utilities.
 *
 * Supports parsing `MAJOR.MINOR.PATCH[-prerelease][+build]` (SemVer 2.0.0 core)
 * and classifying the bump between two versions.
 */

export type Bump = 'major' | 'minor' | 'patch' | 'none';

export interface Semver {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
  build: string[];
}

const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/** Parse a semver string, throwing on malformed input. */
export function parseSemver(input: string): Semver {
  const match = SEMVER_RE.exec(input.trim());
  if (!match) {
    throw new Error(`Invalid semver string: "${input}"`);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split('.') : [],
    build: match[5] ? match[5].split('.') : [],
  };
}

/** Render a parsed version back to a canonical string. */
export function formatSemver(v: Semver): string {
  const core = `${v.major}.${v.minor}.${v.patch}`;
  const pre = v.prerelease.length > 0 ? `-${v.prerelease.join('.')}` : '';
  const build = v.build.length > 0 ? `+${v.build.join('.')}` : '';
  return `${core}${pre}${build}`;
}

/** True when the version carries a prerelease tag (e.g. `1.0.0-beta.1`). */
export function isPrerelease(v: Semver): boolean {
  return v.prerelease.length > 0;
}

/**
 * Classify the bump that turns `from` into `to`.
 *
 * Only the numeric core is considered; a pure prerelease change (same core)
 * is reported as `none`.
 */
export function classifyBump(from: string, to: string): Bump {
  const a = parseSemver(from);
  const b = parseSemver(to);

  if (b.major > a.major) return 'major';
  if (b.minor > a.minor) return 'minor';
  if (b.patch > a.patch) return 'patch';
  return 'none';
}
