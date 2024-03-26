const express = require('express')
app = express()
const path = require('path')
const sqlite3 = require('sqlite3')
const {open} = require('sqlite')
const jwt = require('jsonwebtoken')
const {compare, hash} = require('bcrypt')
const datefns = require('date-fns')
app.use(express.json())
db_path = path.join(__dirname, 'twitterClone.db')
let db = null
const intializeSeverDatabasae = async () => {
  try {
    db = await open({
      filename: db_path,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server started succesfully at https://localhost:3000')
    })
  } catch (e) {
    console.log(`${e} in connecting to Database`)
    process.exit(1)
  }
}
intializeSeverDatabasae()
const authorizeToken = (request, response, next) => {
  const authorizationHeader = request.headers['authorization']
  let jwtToken
  if (authorizationHeader !== undefined) {
    jwtToken = authorizationHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'SECRETKEY', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payload.username
        next()
      }
    })
  }
}
app.post('/register', async (request, response) => {
  const {username, name, password, gender} = request.body
  const checkUserQuery = `select * from user where username='${username}';`
  const checkUser = await db.get(checkUserQuery)
  if (checkUser !== undefined) {
    response.status(400)
    response.send('User already exists')
  } else if (password.length < 6) {
    response.status(400)
    response.send('Password is too short')
  } else {
    hashedPassword = await hash(password, 10)
    let getUserIdQuery = 'select count(*) as count from user'
    let getUserId = await db.get(getUserIdQuery)
    let userId = getUserId.count + 1
    addUserQuery = `insert into user values(${userId},'${name}','${username}','${hashedPassword}','${gender}')`
    await db.run(addUserQuery)
    response.status(200)
    response.send('User created successfully')
  }
})
app.post('/login', async (request, response) => {
  const {username, password} = request.body
  const checkUserQuery = `select * from user where username='${username}';`
  const checkUser = await db.get(checkUserQuery)
  if (checkUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else if (await compare(password, checkUser.password)) {
    const payLoad = {username: username}
    const jwtToken = jwt.sign(payLoad, 'SECRETKEY')
    response.send({jwtToken})
  } else {
    response.status(400)
    response.send('Invalid password')
  }
})
app.get('/user/tweets/feed/', authorizeToken, async (request, response) => {
  const username = request.username
  const getUserIdQuery = `select user_id from user where username='${username}'`
  const getUserId = await db.get(getUserIdQuery)
  const getTweetsQuery = `select user.username,tweet.tweet,tweet.date_time as dateTime from follower inner join user on follower.following_user_id=user.user_id inner join tweet on user.user_id=tweet.user_id where follower.follower_user_id=${getUserId.user_id} order by tweet.date_time ASC limit 4`
  const getTweets = await db.all(getTweetsQuery)
  response.send(getTweets)
})
app.get('/user/following/', authorizeToken, async (request, response) => {
  const username = request.username
  const getUserIdQuery = `select user_id from user where username='${username}'`
  const getUserId = await db.get(getUserIdQuery)
  const getfollowingQuery = `select user.name from follower inner join user on follower.following_user_id=user.user_id where follower.follower_user_id=${getUserId.user_id}`
  const getfollowing = await db.all(getfollowingQuery)
  response.send(getfollowing)
})
app.get('/user/followers/', authorizeToken, async (request, response) => {
  const username = request.username
  const getUserIdQuery = `select user_id from user where username='${username}'`
  const getUserId = await db.get(getUserIdQuery)
  const getfollowingQuery = `select user.name from follower inner join user on follower.follower_user_id=user.user_id where follower.following_user_id=${getUserId.user_id} `
  const getfollowing = await db.all(getfollowingQuery)
  response.send(getfollowing)
})
app.get('/tweets/:tweetId/', authorizeToken, async (request, response) => {
  const username = request.username
  const {tweetId} = request.params
  const getUserIdQuery = `select user_id from user where username='${username}'`
  const getUserId = await db.get(getUserIdQuery)
  const getfollowingQuery = `select user.user_id as following_user_id from follower inner join user on follower.following_user_id=user.user_id where follower.follower_user_id=${getUserId.user_id}`
  const getfollowing = await db.all(getfollowingQuery)
  const tweetUserIdQuery = `select * from tweet where tweet_id=${tweetId}`
  const tweetUserId = await db.get(tweetUserIdQuery)
  const checkUserFollowing = getfollowing.some(
    x => x.following_user_id === tweetUserId.user_id,
  )
  if (checkUserFollowing) {
    const gettweetQuery = `select tweet.tweet,count(distinct(like.like_id)) as likes ,count(distinct(reply.reply_id)) as replies, tweet.date_time as dateTime from tweet inner join reply on tweet.tweet_id=reply.tweet_id inner join like on tweet.tweet_id=like.tweet_id where tweet.tweet_id=${tweetId}`
    let tweet = await db.get(gettweetQuery)
    console.log(tweet)
    response.send(tweet)
  } else {
    response.status(401)
    response.send('Invalid Request')
  }
})
app.get(
  '/tweets/:tweetId/likes/',
  authorizeToken,
  async (request, response) => {
    const username = request.username
    const {tweetId} = request.params
    const getUserIdQuery = `select user_id from user where username='${username}'`
    const getUserId = await db.get(getUserIdQuery)
    const getfollowingQuery = `select user.user_id as following_user_id from follower inner join user on follower.following_user_id=user.user_id where follower.follower_user_id=${getUserId.user_id}`
    const getfollowing = await db.all(getfollowingQuery)
    const tweetUserIdQuery = `select * from tweet where tweet_id=${tweetId}`
    const tweetUserId = await db.get(tweetUserIdQuery)
    const checkUserFollowing = getfollowing.some(
      x => x.following_user_id === tweetUserId.user_id,
    )
    if (checkUserFollowing) {
      const getLikeUsersQuery = `select user.name from tweet inner join like on tweet.tweet_id=like.tweet_id inner join user on like.user_id=user.user_id where tweet.tweet_id=${tweetId}`
      const getLikeUsers = await db.all(getLikeUsersQuery)
      let usersNames = []
      getLikeUsers.map(eachitem => {
        usersNames.push(eachitem.name)
      })
      console.log(usersNames)
      response.send({likes: [...usersNames]})
    } else {
      response.status(401)
      response.send('Invalid Request')
    }
  },
)
app.get(
  '/tweets/:tweetId/replies/',
  authorizeToken,
  async (request, response) => {
    const username = request.username
    const {tweetId} = request.params
    const getUserIdQuery = `select user_id from user where username='${username}'`
    const getUserId = await db.get(getUserIdQuery)
    const getfollowingQuery = `select user.user_id as following_user_id from follower inner join user on follower.following_user_id=user.user_id where follower.follower_user_id=${getUserId.user_id}`
    const getfollowing = await db.all(getfollowingQuery)
    const tweetUserIdQuery = `select * from tweet where tweet_id=${tweetId}`
    const tweetUserId = await db.get(tweetUserIdQuery)
    const checkUserFollowing = getfollowing.some(
      x => x.following_user_id === tweetUserId.user_id,
    )
    if (checkUserFollowing) {
      const getUsersReplyQuery = `select user.name,reply.reply from tweet inner join reply on tweet.tweet_id=reply.tweet_id inner join user on reply.user_id=user.user_id where tweet.tweet_id=${tweetId}`
      const getUsersReply = await db.all(getUsersReplyQuery)
      response.send({replies: [...getUsersReply]})
    } else {
      response.status(401)
      response.send('Invalid Request')
    }
  },
)
app.get('/user/tweets/', authorizeToken, async (request, response) => {
  const username = request.username
  const getUserIdQuery = `select user_id from user where username='${username}'`
  const getUserId = await db.get(getUserIdQuery)
  const getTweetsQuery = `select tweet.tweet,count(like.like_id) as likes ,count(reply.reply_id) as replies, tweet.date_time as dateTime from tweet inner join reply on tweet.tweet_id=reply.tweet_id inner join like on tweet.tweet_id=like.tweet_id where tweet.user_id=${getUserId.user_id} group by tweet.tweet_id`
  let getTweets = await db.all(getTweetsQuery)
  console.log(getTweets)
  getTweets = getTweets.map(eachitem => {
    return {
      tweet: eachitem.tweet,
      likes: eachitem.likes,
      repiles: eachitem.replies,
      dateTime: eachitem.dateTime,
    }
  })
  response.send(getTweets)
})
app.post('/user/tweets/', authorizeToken, async (request, response) => {
  const username = request.username
  const {tweet} = request.body
  const getUserIdQuery = `select user_id from user where username='${username}'`
  const getUserId = await db.get(getUserIdQuery)
  let getTweetIdQuery = 'select count(*) as count from tweet'
  let getTweetId = await db.get(getTweetIdQuery)
  let tweetId = getTweetId.count + 1
  const date = datefns.format(new Date(), 'yyyy-MM-dd H:MM:SS')
  console.log(date)
  const insertTweetsQuery = `insert into tweet values(${tweetId},'${tweet}',${getUserId.user_id},'${date}')`
  await db.run(insertTweetsQuery)
  response.send('Created a Tweet')
})
app.delete('/tweets/:tweetId/', authorizeToken, async (request, response) => {
  const username = request.username
  const {tweetId} = request.params
  const getUserIdQuery = `select user_id from user where username='${username}'`
  const getUserId = await db.get(getUserIdQuery)
  const getTweetUserQuery = `select user_id as tweet_user_id from tweet where tweet_id=${tweetId}`
  const getTweetUser = await db.get(getTweetUserQuery)
  if (getUserId.user_id === getTweetUser.tweet_user_id) {
    const deleteTweetQuery = `delete from tweet where tweet_id=${tweetId}`
    await db.run(deleteTweetQuery)
    response.send('Tweet Removed')
  } else {
    response.status(401)
    response.send('Invalid Request')
  }
})

module.exports = app
