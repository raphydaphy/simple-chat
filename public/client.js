var socket = io("http://localhost:3000");
var userId;

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

/*******************
 * Socket Callbacks
 *******************/
socket.on("init", function(data) {
  jQuery("#userId").text("User ID: " + data.userId);
  jQuery("#nickname-edit").val(data.userName);
  userId = data.userId;
  users = data.userArray;

  for (var msg in data.messageArray) {
    addMessage(data.messageArray[msg]);
  }
});

socket.on("userJoined", function(data) {
  users[data.userId] = {
    id: data.userId,
    name: data.userName
  };
  addMessage(data.message);
});

socket.on("chatMessage", function(msg) {
  addMessage(msg);
});

socket.on("likeMessage", function(data) {
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
  // TODO: profile icons
  var userIcon = "DeadPool";
  likesDiv.first().append(`
    <div class="icon-heart">
      <div class="icon">
        <img unselectable src="img/${userIcon}.svg">
      </div>
    </div>
  `);
});

socket.on("changeUsername", function(data) {
  addMessage(data.message);
  users[data.userId].name = data.name;
});

socket.on("userLeft", function(data) {
  addMessage(data.message);
  // Since the user is not deleted on the server, they should be kept here too
  // delete users[data.userId];
});

window.addEventListener("beforeunload", (event) => {
  socket.emit("userLeft", {
    userId: userId
  });
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
      /* TODO: typing indicator
      if (typingTimer !== null) {
        clearTimeout(typingTimer);
        typingTimer = null;
        socket.emit("typing", { typing: false }, function() {});
      }
      */
      
      jQuery("#chat-input").prop("disabled", true);
      socket.emit("sendMessage", {
        userId: userId,
        content: content,
        isSystemMsg: false
      }, function() {
        jQuery("#chat-input").val("").prop("disabled", false).focus();
      });
    }
  } else {
    /* TODO: typing indicator
    if (typingTimer === null) {
      socket.emit("typing", { typing: true }, function() {});
    } else {
      clearTimeout(typingTimer);
    }
    typingTimer = setTimeout(function() {
      typingTimer = null;
      socket.emit("typing", { typing: false }, function() {});
    }, 500);
    */
  }
});

jQuery('#link-icon').click(e => {
  console.log("linkIcon button clicked");

  var currVideoUrl = window.location.href.split('?')[0];
  // TODO: session id
  var partySessionId = makeId();
  if(currVideoUrl && partySessionId) {
    var urlWithSessionId = currVideoUrl + "?npSessionId=" + encodeURIComponent(partySessionId);
    console.log(urlWithSessionId);
    // jQuery('#share-url').val(urlWithSessionId).focus().select();

    const el = document.createElement("textarea");
    el.value = urlWithSessionId;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);

  }
});

jQuery('.user-icon').click(e => {
  console.log('userIcon button clicked');
  jQuery("#chat-icon-container").show();
  jQuery(".chat-settings-container").hide();
});

jQuery('#user-icon').click(e => {
  console.log("userIcon button clicked");
  toggleIconContainer();
});

jQuery(".btns button").click(e => {
  var nicknameText = jQuery(".nickname-input input").val().replace(/^\s+|\s+$/g, '');
  if(nicknameText != '') {
    console.log("saveChanges button clicked: " + nicknameText);
    socket.emit("changeUsername", {
      userId: userId,
      name: nicknameText
    });
  }
  toggleIconContainer();
});

/************
 * Functions
 ************/
function toggleIconContainer() {
 if(jQuery("#chat-icon-container").data('active')) {
    jQuery("#chat-icon-container").data('active', false);
    jQuery("#chat-icon-container").hide();
    jQuery(".chat-settings-container").hide();
    jQuery("#chat-history-container").show();
    jQuery("#chat-input-container").show();
  } else {
    jQuery("#chat-icon-container").data('active', true);
    jQuery(".chat-settings-container").show();
    jQuery("#chat-icon-container").hide();
    jQuery("#chat-link-container").hide();
    jQuery("#chat-history-container").hide();
    jQuery("#chat-input-container").hide();
  }
}

function getOrCreateLikesDiv(msgId) {
  var msgDiv = jQuery("#msg-" + msgId).children(".msg-txt").first();
  var likesDiv = msgDiv.children(".msg-likes");
  if (likesDiv.length == 0) {
    msgDiv.append(`
      <div class="msg-likes">
        <div class="icon-heart heart-full">
          <div class="icon">
            <i unselectable class="fas fa-heart"></i>
          </div>
        </div>
      </div>
    `);
    likesDiv =  msgDiv.children(".msg-likes");
  }
  return likesDiv;
}

function likeMessage(msg) {
  if (!msg.likes.hasOwnProperty(userId)) {
    socket.emit("likeMessage", {
      msgId: msg.id,
      userId: userId
    });
  }
}

function addMessage(msg) {
  if (!users.hasOwnProperty(msg.userId)) {
    console.warn("Tried to add message from invalid user " + msg.userId, msg);
    return;
  }

  // TODO: user icons
  var userIcon = "img/IronMan.svg";
  var userName = users[msg.userId].name;

  var format = jQuery(`
    <div class="msg-container" id="msg-${msg.id}">
      <div class="icon-name">
        <div class="icon">
          <img unselectable src="${userIcon}">
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
}