const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = global.TextEncoder || TextEncoder;
global.TextDecoder = global.TextDecoder || TextDecoder;

// Load CJS build directly to avoid ESM interop issues in jest
module.exports = require('msw/lib/node');
