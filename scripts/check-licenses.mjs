const chunks = [];

for await (const chunk of process.stdin) {
  chunks.push(chunk);
}

const rawReport = Buffer.concat(chunks)
  .toString('utf8')
  .replace(/^\uFEFF/, '');
const report = JSON.parse(rawReport);
const deniedLicensePattern = /(^|[^A-Z])A?GPL-3\.0(?:-only|-or-later)?($|[^A-Z])/i;
const deniedLicenses = Object.keys(report).filter((license) => deniedLicensePattern.test(license));

if (deniedLicenses.length > 0) {
  console.error(`Denied production licenses: ${deniedLicenses.join(', ')}`);
  process.exit(1);
}

console.log(`Production license review passed (${Object.keys(report).length} license groups).`);
