const tmi = require("tmi.js");
const uuidv4 = require('uuid/v4');
const engine = require('engine.io');
const redis = require("redis");
const bluebird = require("bluebird");
const msgpack = require('msgpack');

const {DATA_EXPIRE, CALCULATE_TOP_CHATS_INTERVAL, loadScript} = require('./common');

const log = require('loglevel');
log.setLevel(process.env.LOGLEVEL || 'info');

// Promisify Redis client.
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

// The top charts can have max 100 chats.
const NUM_TOP_CHATS = 100;

// Check for expired data every ten seconds.
const CHECK_EXPIRE_INTERVAL = 10 * 1000;

function get_seconds_since_epoch() {
  return (new Date()).getTime() / 1000;
}

async function main() {
  const db = redis.createClient({detect_buffers: true});
  await db.flushallAsync();

  const RECORD_MESSAGE_SCRIPT = await loadScript(db, './redis-scripts/record-message.lua');

  setInterval(async () => {
    log.debug("Calculating top scored chats...");
    let ids = await db.zrangeAsync(['scores', 0, NUM_TOP_CHATS - 1]);
    let results = await Promise.all(ids.map(async id => {
      let upvotes = await db.scardAsync(`${id}_upvotes`);
      let data = msgpack.unpack(await db.getAsync(new Buffer(`${id}_data`)));

      return {
        upvotes,
        message: data.message,
        userstate: data.userstate
      }
    }));

    await db.setAsync('top_chats', msgpack.pack(results));
  }, CALCULATE_TOP_CHATS_INTERVAL);

  setInterval(async () => {
    log.debug("Removing old chats from sorted set...");
    let res = await db.zremrangebyscoreAsync(['scores', -get_seconds_since_epoch() + (DATA_EXPIRE / 1000), 'inf']);
    log.debug("%s chats removed...", res);
  }, CHECK_EXPIRE_INTERVAL);


  const client = new tmi.client({
      connection: { reconnect: true },
      channels: ["#gamesdonequick"]
  });

  client.connect();

  client.on("chat", async function (channel, userstate, message, self) {
    let seconds_since_epoch = get_seconds_since_epoch();
    let id = userstate.id;
    var chat = {
      userstate, message
    };

    // Save the chat data, creation time, and, with an expiration time.
    await db.evalshaAsync([RECORD_MESSAGE_SCRIPT, 0, id, seconds_since_epoch, msgpack.pack(chat), DATA_EXPIRE]);

    log.debug("Chat message from %s at %f: %s", userstate['display-name'], seconds_since_epoch, message);
  });
}

main()
