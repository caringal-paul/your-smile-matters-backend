export const logInfo = (msg: string) => console.log(`\x1b[36m${msg}\x1b[0m`);
export const logSuccess = (msg: string) => console.log(`\x1b[32m${msg}\x1b[0m`);
export const logError = (msg: string) => console.error(`\x1b[31m${msg}\x1b[0m`);
