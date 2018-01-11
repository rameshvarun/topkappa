import * as log from "loglevel";

// Copypastas expire after five minutes.
const EXPIRE_TIME = 5 * 60 * 1000;

// Check for expired chats every 30 seconds;
const EXPIRE_CHECK_INTERVAL = 30 * 1000;

const EXPIRE_LIST = [];

const COUNTS = new Map();
const FORMATTING_DATA = new Map();

export function storeMessage(message, userstate) {
  if(!FORMATTING_DATA.has(message)) {
    FORMATTING_DATA.set(message, {
      capitalized: message,
      emotes: userstate.emotes,
    });
  }

  COUNTS.set(message, (COUNTS.get(message) || 0) + 1);
  EXPIRE_LIST.push({message, expires: Date.now() + EXPIRE_TIME});
}

setInterval(() => {
  log.debug("Removing expired chats.");

  let now = Date.now();
  let removed_count = 0;
  while (EXPIRE_LIST.length > 0 && now > EXPIRE_LIST[0].expires) {
    let message = EXPIRE_LIST.shift().message;
    let prevcount = COUNTS.get(message);
    if (prevcount > 1) {
      COUNTS.set(message, prevcount - 1);
    } else {
      COUNTS.delete(message);
      FORMATTING_DATA.delete(message);
    }

    removed_count++;
  }

  log.debug("Processed %d expired messages...", removed_count);
}, EXPIRE_CHECK_INTERVAL)

export function getTopCopypastas(max_num = 10) {
  log.debug("%d chats in counts map.", COUNTS.size);

  let results = Array.from(COUNTS.entries());
  return results.filter(r => r[1] > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max_num)
    .map(r => {
      let id = r[0];
      let formatting = FORMATTING_DATA.get(id);
      return {
        message: formatting.capitalized,
        emotes: formatting.emotes,
        count: r[1]
      };
    });
}
