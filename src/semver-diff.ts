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

const NUMERIC_ID_RE = /^\d+$/;

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

/**
 * Compare two versions by SemVer 2.0.0 precedence.
 *
 * Returns `-1` when `a` has lower precedence than `b`, `1` when higher and `0`
 * when the two are equal. Build metadata is ignored, per SemVer §10.
 */
export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const va = parseSemver(a);
  const vb = parseSemver(b);

  for (const key of ['major', 'minor', 'patch'] as const) {
    if (va[key] !== vb[key]) return va[key] < vb[key] ? -1 : 1;
  }

  // A version without a prerelease outranks the same core with one (SemVer §11.3).
  if (va.prerelease.length === 0 && vb.prerelease.length === 0) return 0;
  if (va.prerelease.length === 0) return 1;
  if (vb.prerelease.length === 0) return -1;

  // Both carry prereleases: compare identifiers left to right (SemVer §11.4).
  const shared = Math.min(va.prerelease.length, vb.prerelease.length);
  for (let i = 0; i < shared; i++) {
    const cmp = compareIdentifiers(va.prerelease[i]!, vb.prerelease[i]!);
    if (cmp !== 0) return cmp;
  }
  if (va.prerelease.length === vb.prerelease.length) return 0;
  return va.prerelease.length < vb.prerelease.length ? -1 : 1;
}

/**
 * Compare two prerelease identifiers. Numeric identifiers are compared
 * numerically and always rank below alphanumeric ones (SemVer §11.4.3-11.4.4).
 */
function compareIdentifiers(a: string, b: string): -1 | 0 | 1 {
  const aNumeric = NUMERIC_ID_RE.test(a);
  const bNumeric = NUMERIC_ID_RE.test(b);
  if (aNumeric && bNumeric) {
    // BigInt keeps very long numeric identifiers exact.
    const na = BigInt(a);
    const nb = BigInt(b);
    return na < nb ? -1 : na > nb ? 1 : 0;
  }
  if (aNumeric) return -1;
  if (bNumeric) return 1;
  // Alphanumeric identifiers compare lexically in ASCII order (not locale order).
  return a < b ? -1 : a > b ? 1 : 0;
}
