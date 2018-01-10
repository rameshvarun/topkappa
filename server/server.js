const engine = require('engine.io');
const redis = require("redis");
const bluebird = require("bluebird");
const {DATA_EXPIRE, CALCULATE_TOP_CHATS_INTERVAL, loadScript} = require('./common');
const msgpack = require('msgpack');

const log = require('loglevel');
log.setLevel(process.env.LOGLEVEL || 'info');

// Promisify Redis client.
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

const TOP_WATCH_INTERVAL = 1 * 1000;

const db = redis.createClient({detect_buffers: true});

const Koa = require('koa');
const Router = require('koa-router');

const app = new Koa();
const router = new Router();

require('koa-ctx-cache-control')(app);

const UPVOTE_MESSAGE_SCRIPT = loadScript(db, './redis-scripts/upvote-message.lua');

router.get('/top', async (ctx) => {
  ctx.cacheControl(CALCULATE_TOP_CHATS_INTERVAL);
  let results = msgpack.unpack(await db.getAsync(new Buffer('top_chats')));
  ctx.body = results;
});

router.post('/upvote', async (ctx) => {
  const {id_token, chat_id} = ctx.request.query;
  await db.evalshaAsync([await UPVOTE_MESSAGE_SCRIPT, 0, chat_id, id_token, DATA_EXPIRE]);
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
