export const operatingSystem = {win32:'windows',linux:'linux',darwin:'mac'}[process.platform];
export const platform = `${operatingSystem || process.platform}-${process.arch}`;
if (!operatingSystem || !(process.arch === 'x64' || operatingSystem === 'mac' && process.arch === 'arm64')) throw new Error('unsupported_platform:' + platform);
export const runtime = await import(`../../../platform/${operatingSystem}/runtime.mjs`);
