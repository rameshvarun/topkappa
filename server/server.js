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

const db = redis.createClient();

const Koa = require('koa');
const Router = require('koa-router');

const app = new Koa();
const router = new Router();

router.get('/top', async (ctx) => {
  let results = JSON.parse(await db.getAsync('top_chats'));
  ctx.body = results;
});

router.post('/upvote', async (ctx) => {
  const {id_token, chat_id} = ctx.request.query;

  let numAdded = await db.saddAsync([`${chat_id}_upvotes`, id_token]);
  if (numAdded == 1) {
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

app.listen(4000);
