// query-string 7 expects a callable CommonJS export; the patched upstream is ESM.
const upstream = require('strideos-uri-decoder');
module.exports = upstream.default ?? upstream;
