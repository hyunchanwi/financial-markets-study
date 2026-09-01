import { compileCourse } from './lib/compiler.mjs';

const output = await compileCourse({ write: false });
console.log(`Content check passed: ${output.units.length} units, ${Object.keys(output.visuals).length} visuals, ${output.coverage.pages} ledger rows.`);
