const engine = require('engine.io');
const redis = require("redis");
const bluebird = require("bluebird");
const {DATA_EXPIRE, CALCULATE_TOP_CHATS_INTERVAL} = require('./common');

const stringify = JSON.stringify;

const log = require('loglevel');
log.setLevel(process.env.LOGLEVEL || 'info');

// Promisify Redis client.
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

const TOP_WATCH_INTERVAL = 1 * 1000;
const NUM_TOP_CHATS = 10;

const UPVOTE_WEIGHT = 10.0;

const db = redis.createClient();

const Koa = require('koa');
const Router = require('koa-router');

const app = new Koa();
const router = new Router();

require('koa-ctx-cache-control')(app);

router.get('/top', async (ctx) => {
  ctx.cacheControl(CALCULATE_TOP_CHATS_INTERVAL);
  let results = JSON.parse(await db.getAsync('top_chats'));
  ctx.body = results;
});

router.post('/upvote', async (ctx) => {
  const {id_token, chat_id} = ctx.request.query;

  let numAdded = await db.saddAsync([`${chat_id}_upvotes`, id_token]);
  if (numAdded == 1) {
    await db.pexpireAsync(`${chat_id}_upvotes`, DATA_EXPIRE);

    log.debug("Incrementing score...")
    await db.zincrbyAsync(["scores", -UPVOTE_WEIGHT, chat_id])
  }
  ctx.body = {};

});

app
  .use(require('koa-cors')())
  .use(router.routes())
  .use(router.allowedMethods())
  .use(require('koa-json'));

const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '127.0.0.1';

log.info("Listening on interface %s, port %s.", HOST, PORT);
app.listen(PORT, HOST);
