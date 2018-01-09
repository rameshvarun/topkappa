const engine = require('engine.io');
const redis = require("redis");
const bluebird = require("bluebird");
const stringify = JSON.stringify;

const log = require('loglevel');
if (process.env.LOGLEVEL) log.setLevel(process.env.LOGLEVEL);

// Promisify Redis client.
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

const TOP_WATCH_INTERVAL = 1 * 1000;
const NUM_TOP_CHATS = 10;

const UPVOTE_WEIGHT = 10.0;

const server = engine.listen(4000);
const db = redis.createClient();

server.on('connection', function (socket) {
  log.debug("Connection opened...");

  let id_token = null;

  var topWatchInterval = setInterval(async () => {
    log.debug("Refetching the top chats.");

  }, TOP_WATCH_INTERVAL);

  console.log("Client connected...");
  socket.on('message', async (data) => {
    data = JSON.parse(data);
    if (data.type === "id-token") {
      id_token = data.token;
      log.debug("id_token = %s", id_token);
    } else if (data.type === "upvote") {
      let numAdded = await db.saddAsync([`${data.id}_upvotes`, id_token]);
      if (numAdded == 1) {
        log.debug("Incrementing score...")
        await db.zincrbyAsync("scores", -UPVOTE_WEIGHT)
      }
    } else {
      log.error("Unkown message %o.", data);
    }
  });

  socket.on('close', function(){
    clearInteval(topWatchInterval);
  });
});
