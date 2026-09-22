/**
 * Structured Logger for Microservices
 */
function createLogger(serviceName) {
  return {
    info: (...args) => console.log(`[${new Date().toISOString()}] [INFO] [${serviceName}]:`, ...args),
    warn: (...args) => console.warn(`[${new Date().toISOString()}] [WARN] [${serviceName}]:`, ...args),
    error: (...args) => console.error(`[${new Date().toISOString()}] [ERROR] [${serviceName}]:`, ...args),
    debug: (...args) => {
      if (process.env.DEBUG) {
        console.log(`[${new Date().toISOString()}] [DEBUG] [${serviceName}]:`, ...args);
      }
    }
  };
}

module.exports = { createLogger };
