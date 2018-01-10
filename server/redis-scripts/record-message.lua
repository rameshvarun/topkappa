local MESSAGE_ID, MESSAGE_TIME, MESSAGE_DATA, EXPIRE_TIME = ARGV[1], ARGV[2], ARGV[3], ARGV[4]
assert(MESSAGE_ID, "Message ID required.")
assert(MESSAGE_TIME, "Message Time required.")
assert(MESSAGE_DATA, "Message Data required.")
assert(EXPIRE_TIME, "Expire time (ms) required.")

-- Add the data to the DB.
redis.call("SET", MESSAGE_ID .. "_data", MESSAGE_DATA)
redis.call("PEXPIRE", MESSAGE_ID .. "_data", EXPIRE_TIME)

-- Add the time to the DB.
redis.call("SET", MESSAGE_ID .. "_time", MESSAGE_TIME)
redis.call("PEXPIRE", MESSAGE_ID .. "_time", EXPIRE_TIME)
