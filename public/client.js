var socket = io("http://localhost:3000");
var userId;
var typingTimer = null;

// All the profile icons with the extensions removed
var icons = ["Batman", "DeadPool", "CptAmerica", "Wolverine", "IronMan", "Goofy", "Alien", "Mulan", "Snow-White", "Poohbear", "Sailormoon", "Sailor-Cat", "Pizza", "Cookie", "Chocobar", "hotdog", "Hamburger", "Popcorn", "IceCream", "ChickenLeg"];

/**
 * User {
 *   id: hash
 *   name: string
 * }
 **/
var users = {};

/**
 * Message {
 *   id: hash
 *   userId: hash
 *   content: string
 *   likes: hash[]
 * }
 **/
 var messages = {};

// From index.js
function makeId() {
  var result = "";
  var hexChars = "0123456789abcdef";
  for (var i = 0; i < 16; i += 1) {
    result += hexChars[Math.floor(Math.random() * 16)];
  }
  return result;
}

function changeIcon(icon) {
  socket.emit("changeIcon", {
    icon: icon
  });

  // This will cause the icon to be updated twice
  // on the client which made the change
  users[userId].icon = icon;
  refreshIcon();
  jQuery("#chat-icon-container").hide();
  jQuery(".chat-settings-container").show();
}

function refreshIcon() {
  var iconPath = "img/" + users[userId].icon + ".svg";
  jQuery("#user-icon").children("img").attr("src", iconPath);
  jQuery(".user-icon").children("img").attr("src", iconPath);
}

function createIconButton(i) {
  var iconButton = jQuery("#icon-holder").append(`
    <a class="image-button">
      <img class="unselectable img-class" src="${"img/" + icons[i] + ".svg"}" id="user-icon-${icons[i]}">
    </a>
  `);

  jQuery("#user-icon-" + icons[i]).click(e => {
    changeIcon(icons[i]);
  });
}

/*******************
 * Socket Callbacks
 *******************/
socket.on("init", function(data) {
  jQuery("#nickname-edit").val(data.userName);
  userId = data.userId;
  users = data.userArray;

  for (var msg in data.messageArray) {
    addMessage(data.messageArray[msg]);
  }

  for(var i =0; i < icons.length; i++) {
    createIconButton(i);
  }

  refreshIcon();
});

socket.on("userJoined", function(data) {
  users[data.userId] = {
    id: data.userId,
    name: data.userName,
    icon: data.userIcon,
    typing: false,
    active: true
  };
  addMessage(data.message);
});

socket.on("chatMessage", function(msg) {
  addMessage(msg);
});

socket.on("likeMessage", function(data) {
  addLike(data);
});

socket.on("typing", function(data) {
  if (!users.hasOwnProperty(data.userId)) {
    console.warn("Tried to update typing status for unknown user " + data.userId);
    return;
  }
  users[data.userId].typing = data.typing;
  var typingUsers = [];
  for (var user in users) {
    if (users[user].typing) {
      typingUsers.push(user);
    }
  }
  var typingMsg = typingUsers.length + " people are typing...";
  if (typingUsers.length == 2) {
    typingMsg = users[typingUsers[0]].name + " and " + users[typingUsers[1]].name + " are typing...";
  } else if (typingUsers.length == 1) {
    typingMsg = users[typingUsers[0]].name + " is typing...";
  } else if (typingUsers.length == 0) {
    typingMsg = "<br />";
  }
  jQuery("#presence-indicator").html(typingMsg);
});

socket.on("changeUsername", function(data) {
  addMessage(data.message);
  users[data.userId].name = data.name;
});

socket.on("changeIcon", function(data) {
  addMessage(data.message);
  users[data.userId].icon = data.icon;
})

socket.on("userLeft", function(data) {
  addMessage(data.message);
  // Since the user is not deleted on the server, they should be kept here too
  // delete users[data.userId];
});

window.addEventListener("beforeunload", (event) => {
  socket.emit("userLeft");
});

/****************
 * JQuery Events
 ****************/
jQuery("#chat-input").keyup(function(e) {
  e.stopPropagation();

  // event keycode 13 is the enter key
  if (e.which === 13) {
    var content = jQuery("#chat-input").val().replace(/^\s+|\s+$/g, "");
    if (content !== "") {
      if (typingTimer !== null) {
        clearTimeout(typingTimer);
        typingTimer = null;
        socket.emit("typing", {
          typing: false
        });
      }
      
      jQuery("#chat-input").prop("disabled", true);
      socket.emit("sendMessage", {
        content: content,
        isSystemMsg: false
      }, function() {
        jQuery("#chat-input").val("").prop("disabled", false).focus();
      });
    }
  } else {
    if (typingTimer === null) {
      socket.emit("typing", { 
        typing: true 
      });
    } else {
      clearTimeout(typingTimer);
    }
    typingTimer = setTimeout(function() {
      typingTimer = null;
      socket.emit("typing", { 
        typing: false 
      });
    }, 500);
  }
});

jQuery("#link-icon").click(e => {
  var currVideoUrl = window.location.href.split("?")[0];
  // TODO: session id
  var partySessionId = makeId();
  if(currVideoUrl && partySessionId) {
    var urlWithSessionId = currVideoUrl + "?npSessionId=" + encodeURIComponent(partySessionId);
    console.log(urlWithSessionId);
    const el = document.createElement("textarea");
    el.value = urlWithSessionId;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);

  }
});

jQuery(".user-icon").click(e => {
  jQuery("#chat-icon-container").show();
  jQuery(".chat-settings-container").hide();
});

jQuery("#user-icon").click(e => {
  toggleIconContainer();
});

jQuery(".btns button").click(e => {
  var nicknameText = jQuery(".nickname-input input").val().replace(/^\s+|\s+$/g, "");
  if(nicknameText != "" && nicknameText != users[userId].name) {
    socket.emit("changeUsername", {
      name: nicknameText
    });
  }
  toggleIconContainer();
});

/************
 * Functions
 ************/
function toggleIconContainer() {
 if(jQuery("#chat-icon-container").data("active")) {
    jQuery("#chat-icon-container").data("active", false);
    jQuery("#chat-icon-container").hide();
    jQuery(".chat-settings-container").hide();
    jQuery("#chat-history-container").show();
    jQuery("#chat-input-container").show();
    jQuery("#patreon-container").show();
  } else {
    jQuery("#chat-icon-container").data("active", true);
    jQuery(".chat-settings-container").show();
    jQuery("#chat-icon-container").hide();
    jQuery("#chat-link-container").hide();
    jQuery("#chat-history-container").hide();
    jQuery("#chat-input-container").hide();
    jQuery("#patreon-container").hide();
  }
}

function getOrCreateLikesDiv(msgId) {
  var msgDiv = jQuery("#msg-" + msgId).children(".msg-txt").first();
  var likesDiv = msgDiv.children(".msg-likes");
  if (likesDiv.length == 0) {
    msgDiv.append(`
      <div class="msg-likes">
        <div class="icon-heart">
          <div class="icon">
            <i class="unselectable fa-heart"></i>
          </div>
        </div>
      </div>
    `);
    likesDiv = msgDiv.children(".msg-likes");
    likesDiv.children(".icon-heart").click(e => {
      likeMessage(messages[msgId]);
    });
  }
  return likesDiv;
}

function likeMessage(msg) {
  if (!msg.likes.hasOwnProperty(userId) && !msg.isSystemMsg) {
    socket.emit("likeMessage", {
      msgId: msg.id
    });
  }
}

function addLike(data) {
  if (!users.hasOwnProperty(data.userId)) {
    console.warn("Recieved like from unknown user " + data.userId + " for message with id " + data.msgId);
    return;
  } else if (!messages.hasOwnProperty(data.msgId)) {
    console.warn("User " + data.userId + " tried to like unknown message " + data.msgId);
    return;
  }
  var msg = messages[data.msgId];
  msg.likes[data.userId] = {
    userId: data.userId,
    timestamp: data.timestamp
  };

  var msgDiv = jQuery("#msg-" + msg.id).children(".msg-txt").first();
  var likesDiv = getOrCreateLikesDiv(msg.id);
  var heart = likesDiv.children(".icon-heart").first();
  var heartIcon = heart.children(".icon").first().children(".fa-heart").first();
  if (msg.likes.hasOwnProperty(userId)) {
    heart.addClass("heart-full");
    heart.removeClass("heart-empty");

    heartIcon.addClass("fas");
    heartIcon.removeClass("far");
  } else {
    heart.addClass("heart-empty");
    heart.removeClass("heart-full");

    heartIcon.addClass("far");
    heartIcon.removeClass("fas");
  }

  likesDiv.first().append(`
    <div class="icon-heart unselectable">
      <div class="icon unselectable">
        <img class="unselectable" src="img/${users[data.userId].icon}.svg">
      </div>
    </div>
  `);
  jQuery("#chat-history").scrollTop(jQuery("#chat-history").prop("scrollHeight"));
}

function addMessage(msg) {
  if (!users.hasOwnProperty(msg.userId)) {
    console.warn("Tried to add message from invalid user " + msg.userId, msg);
    return;
  }

  var userName = users[msg.userId].name;

  var format = jQuery(`
    <div class="msg-container" id="msg-${msg.id}">
      <div class="icon-name">
        <div class="icon">
          <img class="unselectable" src="${"img/" + users[msg.userId].icon + ".svg"}">
        </div>
      </div>
      <div class="msg-txt message${ msg.isSystemMsg ? "-system" : "-txt" }">
        <h3>${userName.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</h3>
        <p>${msg.content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
      </div>
    </div>
  `).appendTo(jQuery("#chat-history")).data("messageId", msg.id).data("userName", userName);

  jQuery("#msg-" + msg.id).dblclick(e => {
    likeMessage(msg);
  });

  jQuery("#chat-history").scrollTop(jQuery("#chat-history").prop("scrollHeight"));

  messages[msg.id] = msg;

  for (like in msg.likes) {
    addLike({
      msgId: msg.id,
      userId: like
    });
  }
}