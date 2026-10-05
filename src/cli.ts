#!/usr/bin/env node
import { classifyBump, parseSemver } from './semver-diff.js';

function main(argv: string[]): number {
  const [from, to] = argv;
  if (!from || !to) {
    process.stderr.write('usage: cli <from-version> <to-version>\n');
    return 2;
  }
  try {
    const bump = classifyBump(from, to);
    const a = parseSemver(from);
    const b = parseSemver(to);
    process.stdout.write(`bump: ${bump}\n`);
    process.stdout.write(`major: ${a.major} -> ${b.major}\n`);
    process.stdout.write(`minor: ${a.minor} -> ${b.minor}\n`);
    process.stdout.write(`patch: ${a.patch} -> ${b.patch}\n`);
    return 0;
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    return 1;
  }
}

process.exitCode = main(process.argv.slice(2));
