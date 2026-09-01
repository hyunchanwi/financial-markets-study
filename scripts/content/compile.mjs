import { compileCourse } from './lib/compiler.mjs';

const output = await compileCourse({ write: true });
console.log(`Compiled ${output.units.length} detailed units (${output.coverage.mapped}/${output.coverage.pages} source pages mapped).`);
