import { describe, expect, it } from 'vitest';
import {
  classifyBump,
  compareSemver,
  formatSemver,
  isPrerelease,
  parseSemver,
} from '../src/semver-diff.js';

describe('parseSemver', () => {
  it('parses a plain version', () => {
    expect(parseSemver('1.2.3')).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: [],
      build: [],
    });
  });

  it('parses a prerelease version', () => {
    expect(parseSemver('1.2.3-beta.1').prerelease).toEqual(['beta', '1']);
  });

  it('parses build metadata', () => {
    expect(parseSemver('1.2.3+build.42').build).toEqual(['build', '42']);
  });

  it('trims surrounding whitespace', () => {
    expect(parseSemver('  2.0.0  ').major).toBe(2);
  });

  it('rejects invalid input', () => {
    expect(() => parseSemver('1.2')).toThrow(/Invalid semver/);
  });

  it('rejects leading-zero components', () => {
    expect(() => parseSemver('01.2.3')).toThrow(/Invalid semver/);
  });
});

describe('formatSemver', () => {
  it('round-trips a prerelease + build version', () => {
    const v = parseSemver('1.2.3-beta.1+exp.sha.5114f85');
    expect(formatSemver(v)).toBe('1.2.3-beta.1+exp.sha.5114f85');
  });
});

describe('isPrerelease', () => {
  it('detects prerelease tags', () => {
    expect(isPrerelease(parseSemver('1.0.0-rc.1'))).toBe(true);
    expect(isPrerelease(parseSemver('1.0.0'))).toBe(false);
  });
});

describe('classifyBump', () => {
  it('classifies a major bump', () => {
    expect(classifyBump('1.2.3', '2.0.0')).toBe('major');
  });

  it('classifies a minor bump', () => {
    expect(classifyBump('1.2.3', '1.3.0')).toBe('minor');
  });

  it('classifies a patch bump', () => {
    expect(classifyBump('1.2.3', '1.2.4')).toBe('patch');
  });

  it('returns none for identical versions', () => {
    expect(classifyBump('1.2.3', '1.2.3')).toBe('none');
  });
});

describe('compareSemver', () => {
  it('orders by major, then minor, then patch', () => {
    expect(compareSemver('1.2.3', '2.0.0')).toBe(-1);
    expect(compareSemver('1.3.0', '1.2.9')).toBe(1);
    expect(compareSemver('1.2.3', '1.2.4')).toBe(-1);
  });

  it('treats a release as higher than its prerelease', () => {
    expect(compareSemver('1.0.0', '1.0.0-rc.1')).toBe(1);
    expect(compareSemver('1.0.0-alpha', '1.0.0')).toBe(-1);
  });

  it('orders prerelease identifiers', () => {
    expect(compareSemver('1.0.0-alpha', '1.0.0-beta')).toBe(-1);
    expect(compareSemver('1.0.0-beta.2', '1.0.0-beta')).toBe(1);
  });

  it('ignores build metadata', () => {
    expect(compareSemver('1.0.0+build.1', '1.0.0+build.2')).toBe(0);
  });

  it('compares numeric prerelease identifiers numerically', () => {
    expect(compareSemver('1.0.0-alpha.10', '1.0.0-alpha.2')).toBe(1);
    expect(compareSemver('1.0.0-alpha.2', '1.0.0-alpha.10')).toBe(-1);
    expect(compareSemver('1.0.0-alpha.9', '1.0.0-alpha.10')).toBe(-1);
    expect(compareSemver('1.0.0-alpha.10', '1.0.0-alpha.9')).toBe(1);
    expect(compareSemver('1.0.0-alpha.10', '1.0.0-alpha.10')).toBe(0);
  });

  it('ranks numeric identifiers below alphanumeric ones', () => {
    expect(compareSemver('1.0.0-1', '1.0.0-alpha')).toBe(-1);
    expect(compareSemver('1.0.0-alpha', '1.0.0-1')).toBe(1);
    expect(compareSemver('1.0.0-99999', '1.0.0-a')).toBe(-1);
    expect(compareSemver('1.0.0-alpha.1', '1.0.0-alpha.beta')).toBe(-1);
  });

  it('compares alphanumeric identifiers by ASCII order', () => {
    expect(compareSemver('1.0.0-Z', '1.0.0-a')).toBe(-1);
    expect(compareSemver('1.0.0-alpha', '1.0.0-alpha1')).toBe(-1);
  });

  it('follows the SemVer 2.0.0 section 11 precedence example chain', () => {
    const chain = [
      '1.0.0-alpha',
      '1.0.0-alpha.1',
      '1.0.0-alpha.beta',
      '1.0.0-beta',
      '1.0.0-beta.2',
      '1.0.0-beta.11',
      '1.0.0-rc.1',
      '1.0.0',
    ];
    for (let i = 0; i < chain.length - 1; i++) {
      expect(compareSemver(chain[i]!, chain[i + 1]!)).toBe(-1);
      expect(compareSemver(chain[i + 1]!, chain[i]!)).toBe(1);
    }
  });
});
