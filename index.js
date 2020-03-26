const express = require("express");
const app = express();
const fs = require("fs");
const path = require("path");

var http = require("http").createServer(app);
var io = require("socket.io")(http);

/****************************
 *  Utilities
 ****************************/

// An array of default usernames
const usernames = ["James", "Hannah", "Tracy", "Bob", "Troy", "George", "Eve"];

/**
 * User {
 *   id: hash
 *   name: string
 *   socket: <websocket>
 * }
 **/
var users = {}

/**
 * Message {
 *   id: hash
 *   userId: hash
 *   content: string
 *   likes: hash[]
 * }
 **/
var messages = {}

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
    likes: []
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

app.get("/*", function(req, res) {
  res.sendFile(path.join(__dirname, "public", req.path));
});

/****************************
 *  Message Handlers
 ****************************/

io.on("connection", function(socket) {
  var userId = makeId();
  var userName = usernames[Math.floor(Math.random() * usernames.length)];
  while (users.hasOwnProperty(userId)) {
    userId = makeId();
  }

  users[userId] = {
    id: userId,
    name: userName,
    socket: socket
  };

  var joinedMsg = createMessage(userId, "joined the chat", true);
  var clientUsers = {};

  for (var user in users) {
    clientUsers[user] = {
      id: users[user].id,
      name: users[user].name
    };

    if (user != userId) {
      users[user].socket.emit("userJoined", {
        userId: userId,
        userName: userName,
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

  console.log("User " + userId + " connected and assigned the name " + userName);

  socket.on("sendMessage", function(data) {
    if (!users.hasOwnProperty(data.userId)) {
      console.warn("Recieved message from invalid userId " + data.userId + ": " + data.content);
      return;
    }
    var message = createMessage(data.userId, data.content, data.isSystemMsg);
    broadcastMessage(message);
  });

  socket.on("changeUsername", function(data) {
    if (!users.hasOwnProperty(data.userId)) {
      console.warn("Non-existant user " + data.userId + " tried to change name to " + data.name);
      return;
    }
    var name = data.name;
    var message = createMessage(data.userId, "changed their nickname to " + name, true);

    users[data.userId].name = name;

    for (var user in users) {
      users[user].socket.emit("changeUsername", {
        userId: data.userId,
        name: name,
        message: message
      });
    }
  });

  socket.on("userLeft", function(data) {
    if (!users.hasOwnProperty(data.userId)) {
      console.warn("Non-existant user " + data.userId + " tried to leave the chat");
      return;
    }
    var message = createMessage(data.userId, "left the chat", true);

    for (var user in users) {
      if (user != data.userId) {
        users[user].socket.emit("userLeft", {
          userId: data.userId,
          message: message
        });
      }
    }
    // Keeping the user in the array allows chat history to persist
    // delete users[data.userId];
  });
});

var server = http.listen(process.env.PORT || 3000, function() {
  console.log("Listening on port %d.", server.address().port);
});
