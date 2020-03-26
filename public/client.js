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

socket.on("init", function(data) {
  jQuery("#userId").text("User ID: " + data.userId);
  jQuery("#name").val(data.userName);
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

jQuery('#chat-input').keyup(function(e) {
  console.log('hi');
  e.stopPropagation();

  // event keycode 13 is the enter key
  if (e.which === 13) {
    var content = jQuery('#chat-input').val().replace(/^\s+|\s+$/g, '');
    if (content !== '') {
      if (typingTimer !== null) {
        /* TODO: typing indicator
        clearTimeout(typingTimer);
        typingTimer = null;
        socket.emit('typing', { typing: false }, function() {});
        */
      }
      
      jQuery('#chat-input').prop('disabled', true);
      socket.emit('sendMessage', {
        userId: userId,
        body: body,
        isSystemMsg: false
      }, function() {
        jQuery('#chat-input').val('').prop('disabled', false).focus();
      });
    }
  } else {
    /* TODO: typing indicator
    if (typingTimer === null) {
      socket.emit('typing', { typing: true }, function() {});
    } else {
      clearTimeout(typingTimer);
    }
    typingTimer = setTimeout(function() {
      typingTimer = null;
      socket.emit('typing', { typing: false }, function() {});
    }, 500);
    */
  }
});

function updateProfile() {
  var name = jQuery("#name").val();
  if (name.length > 0) {
    socket.emit("changeUsername", {
      userId: userId,
      name: name
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
    <div class="msg-container">
        <div class="icon-name">
          <div class="icon">
            <img src="${userIcon}">
          </div>
        </div>
        <div class="msg-txt message${ msg.isSystemMessage ? '-system' : '-txt' }">
          <h3>${userName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</h3>
          <p>${msg.content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
        </div>
      </div>
  `).appendTo(jQuery('#chat-history')).data('messageId', msg.id).data('userName', userName);

  // jQuery("#message-history").append("<p>" + format + "</p>");
  messages[msg.id] = msg;
}