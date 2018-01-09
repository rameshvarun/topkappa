const tmi = require("tmi.js");
const uuidv4 = require('uuid/v4');
const engine = require('engine.io');
const redis = require("redis");
const bluebird = require("bluebird");
const {DATA_EXPIRE} = require('./common');

const log = require('loglevel');
if (process.env.LOGLEVEL) log.setLevel(process.env.LOGLEVEL);

// Promisify Redis client.
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

// Recalculate the top charts every five seconds.
const CALCULATE_TOP_CHATS_INTERVAL = 5 * 1000;

// The top charts can have max 100 chats.
const NUM_TOP_CHATS = 100;

// Check for expired data every ten seconds.
const CHECK_EXPIRE_INTERVAL = 10 * 1000;

function get_seconds_since_epoch() {
  return (new Date()).getTime() / 1000;
}

async function main() {
  const db = redis.createClient();
  await db.flushallAsync();

  setInterval(async () => {
    log.debug("Calculating top scored chats...");
    let ids = await db.zrangeAsync(['scores', 0, NUM_TOP_CHATS - 1]);
    let results = await Promise.all(ids.map(async id => {
      let upvotes = await db.scardAsync(`${id}_upvotes`);
      let data = JSON.parse(await db.getAsync(`${id}_data`));

      return {
        upvotes,
        message: data.message,
        userstate: data.userstate
      }
    }));

    results = results.filter(res => res.upvotes > 0);
    await db.setAsync('top_chats', JSON.stringify(results));
  }, CALCULATE_TOP_CHATS_INTERVAL);

  setInterval(async () => {
    log.debug("Removing old chats from sorted set...");
    let res = await db.zremrangebyscoreAsync(['scores', -get_seconds_since_epoch() + (DATA_EXPIRE / 1000), 'inf']);
    log.debug("%s chats removed...", res);
  }, CHECK_EXPIRE_INTERVAL);


  const client = new tmi.client({
      connection: {
          reconnect: true
      },
      identity: {
          username: process.env.TWITCH_USERNAME,
          password: process.env.TWITCH_OATH_PASSWORD
      },
      channels: ["#gamesdonequick"]
  });

  client.connect();

  client.on("chat", async function (channel, userstate, message, self) {
    let seconds_since_epoch = get_seconds_since_epoch();
    let id = userstate.id;
    var chat = {
      userstate, message
    };

    // Save the chat data, with an expiration time.
    await db.setAsync(`${id}_data`, JSON.stringify(chat));
    await db.pexpireAsync([`${id}_data`, DATA_EXPIRE]);

    await db.zaddAsync(['scores', 'NX', -seconds_since_epoch, id]);

    log.debug("Chat message from %s at %f: %s", userstate['display-name'], seconds_since_epoch, message);
  });
}

main()
