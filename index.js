const express = require("express");
const app = express();
const fs = require("fs");
const usernames = ["James", "Hannah", "Tracy", "Bob", "Troy", "George", "Eve"];

var http = require("http").createServer(app);
var io = require("socket.io")(http);

/****************************
 *  Utilities
 ****************************/

/**
 * User {
 *   id: hash
 *   name: string
 *   socket: <websocket>
 * }
 **/
var users = {}

// generate a random ID with 64 bits of entropy
function makeId() {
  var result = "";
  var hexChars = "0123456789abcdef";
  for (var i = 0; i < 16; i += 1) {
    result += hexChars[Math.floor(Math.random() * 16)];
  }
  return result;
}

function broadcastMessage(message, except=null) {
  for (var user in users) {
    if (user != except) {
      users[user].socket.emit("chatMessage", {
        userId: message.userId,
        body: message.body,
        isSystemMsg: message.isSystemMsg
      });
    }
  }
}

/****************************
 *  Web Endpoints
 ****************************/

app.get("/", function(req, res) {
  fs.readFile("./index.html", function(err, data) {
    if (err) {
      res.writeHead(500);
      return res.end("Error loading index.html");
    }
    res.writeHead(200);
    res.end(data);
  });
});

/****************************
 *  Socket Things
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

  var clientUsers = {};

  for (var user in users) {
    clientUsers[user] = {
      id: users[user].id,
      name: users[user].name
    };

    if (user != userId) {
      users[user].socket.emit("userJoined", {
        userId: userId,
        userName: userName
      });
    }
  }

  socket.emit("init", {
    userId: userId,
    userName: userName,
    userArray: clientUsers
  });

  console.log("User " + userId + " connected and assigned the name " + userName);

  socket.on("sendMessage", function(data) {
    var sender = data.userId;
    var body = data.body;

    broadcastMessage(data, userId);
  });

  socket.on("changeUsername", function(data) {
    var user = data.userId;
    var name = data.name;

    users[user].name = name;

    for (var u in users) {
      if (u != user) {
        users[u].socket.emit("changeUsername", {
          userId: user,
          name: name
        });
      }
    }
  });

  socket.on("userLeft", function(data) {
    var user = data.userId;

    for (var u in users) {
      if (u != user) {
        users[u].socket.emit("userLeft", {
          userId: user
        });
      }
    }
    delete users[data.userId];
  });
});

var server = http.listen(process.env.PORT || 3000, function() {
  console.log("Listening on port %d.", server.address().port);
});
