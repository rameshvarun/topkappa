local MESSAGE_ID, USER_ID, EXPIRE_TIME = ARGV[1], ARGV[2], ARGV[3]
assert(MESSAGE_ID, "Message ID required.")
assert(USER_ID, "User ID required.")
assert(EXPIRE_TIME, "Expire time (ms) required.")

local UPVOTE_WIEGHT = 10.0
local function score(time, num_upvotes)
  return -time - num_upvotes * UPVOTE_WIEGHT
end

local UPVOTES_SET = MESSAGE_ID .. '_upvotes'

local upvote_set_exists = redis.call("EXISTS", UPVOTES_SET)

local num_added = redis.call("SADD", UPVOTES_SET, USER_ID)
if upvote_set_exists == 0 then
  redis.call("PEXPIRE", UPVOTES_SET, EXPIRE_TIME)
end

-- If the user is already in the upvotes set, then return.
if num_added == 0 then return end

-- If the time isn't stored in the DB, then the server hasn't seen this message
-- and can't confirm that it exists.
local time = redis.call('GET', MESSAGE_ID .. "_time")
if time == false then return end

local num_upvotes = redis.call('SCARD', UPVOTES_SET)
redis.call('ZADD', 'scores', score(time, num_upvotes), MESSAGE_ID)
