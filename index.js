const express = require("express");
const app = express();
const path = require("path");

var http = require("http").createServer(app);
var io = require("socket.io")(http);

/****************************
 *  Utilities
 ****************************/

// An array of default usernames
const usernames = ["James", "Hannah", "Tracy", "Bob", "Troy", "George", "Eve"];

// All the profile icons with the extensions removed
var icons = ["Batman", "DeadPool", "CptAmerica", "Wolverine", "IronMan", "Goofy", "Alien", "Mulan", "Snow-White", "Poohbear", "Sailormoon", "Sailor-Cat", "Pizza", "Cookie", "Chocobar", "hotdog", "Hamburger", "Popcorn", "IceCream", "ChickenLeg"];

// Used to create timestamps
const date = new Date();

/**
 * User {
 *   id: hash
 *   name: string
 *   icon: string
 *   typing: boolean
 *   active: boolean
 *   sessionId: hash
 *   socket: <websocket>
 * }
 **/
var users = {}

/**
 * Message {
 *   id: hash
 *   userId: hash
 *   content: string
 *   time: timestamp (date.getTime())
 *   likes: hash (key) {
 *     userId: hash
 *     time: timestamp
 *   }
 * }
 **/
var messages = {}

/* not properly implemented yet */
var sessions = {}

// generate a random ID with 64 bits of entropy
function makeId() {
  var result = "";
  var hexChars = "0123456789abcdef";
  for (var i = 0; i < 16; i += 1) {
    result += hexChars[Math.floor(Math.random() * 16)];
  }
  return result;
}

function createMessage(userId, content, isSystemMsg) {
  var messageId = makeId();
  while (messages.hasOwnProperty(messageId)) {
    messageId = makeId();
  }

  var message = {
    id: messageId,
    userId: userId,
    content: content,
    isSystemMsg: isSystemMsg,
    timestamp: date.getTime(),
    likes: {}
  };

  messages[messageId] = message;
  return message;
}

function broadcastMessage(message, except=null) {
  for (var user in users) {
    if (user != except) {
      users[user].socket.emit("chatMessage", message);
    }
  }
}

/****************************
 *  Web Endpoints
 ****************************/

app.get("/", function(req, res) {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// TODO: persistant user storage
app.get("/create-user-id", function(req, res) {
  res.setHeader('Content-Type', 'text/plain');
  res.send(makeId());
})

app.get("/*", function(req, res) {
  var filePath = path.join(__dirname, "public", req.path);
  res.sendFile(filePath); 
});

/****************************
 *  Message Handlers
 ****************************/

io.on("connection", function(socket) {
  var userId = makeId();
  var userName = usernames[Math.floor(Math.random() * usernames.length)];
  var userIcon = icons[Math.floor(Math.random() * icons.length)];
  while (users.hasOwnProperty(userId)) {
    userId = makeId();
  }

  users[userId] = {
    id: userId,
    name: userName,
    icon: userIcon,
    typing: false,
    active: true,
    sessionId: "",
    socket: socket
  };

  var joinedMsg = createMessage(userId, "joined the chat", true);
  var clientUsers = {};

  for (var user in users) {
    clientUsers[user] = {
      id: users[user].id,
      name: users[user].name,
      icon: users[user].icon,
      typing: users[user].typing,
      active: users[user].active
    };

    if (user != userId) {
      users[user].socket.emit("userJoined", {
        userId: userId,
        userName: userName,
        userIcon: userIcon,
        message: joinedMsg
      });
    }
  }

  socket.emit("init", {
    userId: userId,
    userName: userName,
    userArray: clientUsers,
    messageArray: messages
  });

  console.log("User " + userId + " connected and assigned the name " + userName + " and icon " + userIcon);

  // TODO: sessions!!
  socket.on("createSession", function(data, callback) {
    var controlLock = data.controlLock;
    var videoId = data.videoId;
    var videoService = data.videoService;
    var syncFromEnd = data.syncFromEnd;
    var videoDuration = data.videoDuration;
    var permID = data.permID; // replace with userID ?

    var sessionId = makeId();
    while (sessions.hasOwnProperty(sessionId)) {
      sessionId = makeId();
    }
    var now = new Date();

    sessions[sessionId] = {
      id: sessionId,
      lastKnownTime: 0,
      lastKnownTimeUpdatedAt: now,
      videoId: videoId,
      state: "paused",
      ownerId: controlLock ? userId : null,
      users: [
        userId
      ]
    };

    users[userId].sessionId = sessionId;

    callback({
      lastKnownTime: 0,
      lastKnownTimeUpdatedAt: now,
      sessionId: sessionId,
      state: "paused"
    });
  });

  socket.on("joinSession", function(data, callback) {
    var sessionId = data.sessionId;
    if (!sessions.hasOwnProperty(sessionId)) {
      callback({
        errorMessage: "Invalid session ID!"
      });
      return;
    }
    var session = sessions[sessionId];
    users[userId].sessionId = sessionId;
    session.users.push(userId);
    callback({
      errorMessage: null,
      videoId: session.videoId,
      lastKnownTime: session.lastKnownTime,
      lastKnownTimeUpdatedAt: session.lastKnownTimeUpdatedAt.getTime(),
      ownerId: session.ownerId,
      state: session.state
    });
  });

  socket.on("updateSession", function(data, callback) {
    if (!sessions.hasOwnProperty(users[userId].sessionId)) {
      callback({
        errorMessage: "Invalid session!"
      });
      return;
    }
    var lastKnownTime = data.lastKnownTime;
    var lastKnownTimeUpdatedAt = data.lastKnownTimeUpdatedAt;
    var state = data.state;
    var lastKnownTimeRemaining = data.lastKnownTimeRemaining;
    var lastKnownTimeRemainingText = data.lastKnownTimeRemainingText;
    var videoDuration = data.videoDuration;
    var bufferingState = data.bufferingState;

    var session = sessions[users[userId].sessionId];

    session.lastKnownTime = lastKnownTime;
    session.lastKnownTimeUpdatedAt = new Date(data.lastKnownTimeUpdatedAt);
    session.state = state;

    for (var user in users) {
      if (user != userId) {
        users[user].socket.emit("update", {
          lastKnownTime: lastKnownTime,
          lastKnownTimeUpdatedAt: session.lastKnownTimeUpdatedAt.getTime(),
          state: state
        });
      }
    }
    callback({
      errorMessage: null
    });
  });

  socket.on("updateSessionFromEnd", function(data, callback) {

  });

  socket.on("leaveSession", function(data, callback) {
    users[userId].sessionId = "";
    callback();
  });

  socket.on("sendMessage", function(data, callback) {
    var message = createMessage(userId, data.content, data.isSystemMsg);
    broadcastMessage(message);

    callback();
  });

  socket.on("likeMessage", function(data) {
    if (!messages.hasOwnProperty(data.msgId)) {
      console.warn("User " + userId + " tried to like invalid message " + data.msgId);
      return;
    }
    var timestamp = date.getTime();
    var msg = messages[data.msgId];
    if (msg.likes.hasOwnProperty(userId)) {
      var name = users[userId].name;
      console.log("User " + name + " tried to like a message they had already liked (with " + Object.keys(msg.likes).length + ") total likes", msg.likes);
      return;
    }
    msg.likes[userId] = {
      userId: userId,
      timestamp: timestamp
    };
    for (var user in users) {
      users[user].socket.emit("likeMessage", {
        msgId: data.msgId,
        userId: userId,
        timestamp: timestamp
      });
    }
  });

  socket.on("typing", function(data) {
    users[userId].typing = data.typing;
    for (var user in users) {
      if (user != userId) {
        users[user].socket.emit("typing", {
          userId: userId,
          typing: data.typing
        });
      }
    }
  })

  socket.on("changeUsername", function(data) {
    var message = createMessage(userId, "changed their nickname to " + data.name, true);

    users[userId].name = data.name;

    for (var user in users) {
      users[user].socket.emit("changeUsername", {
        userId: userId,
        name: data.name,
        message: message
      });
    }
  });

  socket.on("changeIcon", function(data) {
    var message = createMessage(userId, "updated their profile picture", true);

    users[userId].icon = data.icon;

    for (var user in users) {
      users[user].socket.emit("changeIcon", {
        userId: userId,
        icon: data.icon,
        message: message
      });
    }
  });

  socket.on("userLeft", function() {
    var message = createMessage(userId, "left the chat", true);

    users[userId].active = false;
    var anyoneOnline = false;

    for (var user in users) {
      if (user != userId) {
        var userObj = users[user];
        if (userObj.active) {
          anyoneOnline = true;
        }
        userObj.socket.emit("userLeft", {
          userId: userId,
          message: message
        });
      }
    }

    if (!anyoneOnline) {
      messages = {};
      users = {};
      console.log("All users have left. Resetting chat...");
    }
  });

  socket.on("getServerTime", function(data, callback) {
    callback(date.getTime());
  });
});

var server = http.listen(process.env.PORT || 3000, function() {
  console.log("Listening on port %d.", server.address().port);
});
