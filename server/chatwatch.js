const tmi = require("tmi.js");
const uuidv4 = require('uuid/v4');
const engine = require('engine.io');
const redis = require("redis");
const bluebird = require("bluebird");

const log = require('loglevel');
if (process.env.LOGLEVEL) log.setLevel(process.env.LOGLEVEL);

// Promisify Redis client.
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

const CALCULATE_TOP_CHATS_INTERVAL = 5 * 1000;

const NUM_TOP_CHATS = 100;

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
    await db.set(`top_chats`, JSON.stringify(results));
  }, CALCULATE_TOP_CHATS_INTERVAL);

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
    let seconds_since_epoch = (new Date()).getTime() / 1000;
    let id = userstate.id;
    var chat = {
      userstate, message
    };

    await db.set(`${id}_data`, JSON.stringify(chat));
    await db.zaddAsync(['scores', 'NX', -seconds_since_epoch, id]);

    log.debug("Chat message from %s at %f: %s", userstate['display-name'], seconds_since_epoch, message);
  });
}

main()
