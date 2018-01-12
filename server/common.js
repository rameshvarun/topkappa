const fs = require('fs');
const log = require('loglevel');

// Chat data expires after 10 hours.
module.exports.DATA_EXPIRE = 10 * 60 * 60 * 1000;

// Recalculate the top charts every two seconds.
module.exports.CALCULATE_TOP_CHATS_INTERVAL = 3 * 1000;

module.exports.loadScript = async function (db, filename) {
  let code = fs.readFileSync(filename, 'utf-8');
  let sha = await db.scriptAsync(["LOAD", code]);
  log.info("Loaded script %s with SHA %s.", filename, sha);
  return sha;
}
