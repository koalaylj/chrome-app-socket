function str2ba(str) {
  if (typeof (str) !== "string") {
    throw ("Only type string is allowed in str2ba");
  }
  ba = [];
  for (var i = 0; i < str.length; i++) {
    ba.push(str.charCodeAt(i));
  }
  return ba;
}

function ba2str(ba) {
  if (typeof (ba) !== "object") {
    throw ("Only type object is allowed in ba2str");
  }
  var result = "";
  for (var i = 0; i < ba.length; i++) {
    result += String.fromCharCode(ba[ i ]);
  }
  return result;
}

console.log('chrome app socket started')

const connections = new Map(); // <socketId, buffer:[] >

//listen external chrome extension event
chrome.runtime.onMessageExternal.addListener(

  (options, sender, callback) => {
    console.log('onMessage', 'options:', options, 'sender:', sender);
    switch (options.action) {
      case 'connect':
        connect(options.host, options.port, callback);
        break;
      case 'send':
        send(options.socketId, options.data, callback);
        break;
      case 'recv':
        recv(options.socketId, callback);
        break;
      case 'close ':
        close(options.socketId);
        break;
      default:
        console.warn("unknown action", options.action)
        break;
    }
    return true
  }
);

//listen socket onReceive event
chrome.sockets.tcp.onReceive.addListener(receiveInfo => {
  console.log('socket onReceive', receiveInfo);

  let socketId = receiveInfo.socketId

  if (!connections.has(socketId)) {
    console.warn('unknown socket', socketId);
    return;
  }

  var view = new DataView(receiveInfo.data);
  var chunk = new Uint8Array();

  for (var i = 0; i < view.byteLength; i++) {
    chunk.push(view.getUint8(i));
  }

  let buffer = connections.get(socketId)

  buffer = [].concat(buffer, chunk);

  connections.set(socketId, buffer)
});

function connect(host, port, callback) {
  console.log('action connect', host, port);

  chrome.sockets.tcp.create(createInfo => {
    var socketId = createInfo.socketId;

    chrome.sockets.tcp.connect(socketId, host, port, res => {
      if (res < 0) {
        console.error('socket connect error');
        callback({ code: 1, mes: 'socket connect error' });
        return;
      }
      console.log('connected', socketId);
      connections.set(socketId, []);
      callback({ code: 0, mes: socketId });
    });
  });
}

function receive(socketId, callback) {
  console.log('action receive', socketId);
  if (!connections.has(socketId)) {
    callback({ code: 1, mes: 'can not find socket:' + socketId });
    return
  }
  var timer = setInterval(function() {
    let buffer = connections.get(socketId)
    if (buffer.length > 0) {
      clearInterval(timer);
      connections.set(socketId, []);
      callback({ code: 0, mes: buffer });
    }
  }, 100);
}

function send(socketId, data, callback) {
  console.log('action send', socketId, data);
  var ab = new ArrayBuffer(data.length);
  var dv = new DataView(ab);

  for (var i = 0; i < data.length; i++) {
    dv.setUint8(i, data[ i ]);
  }

  chrome.sockets.tcp.send(socketId, ab, sendInfo => {
    if (sendInfo < 0) {
      console.error('socket send error');
      callback({ code: 1, mes: 'send failed:' + sendInfo })
      return;
    }
    callback({ code: 0, mes: sendInfo })
  });
}

function close(socketId) {
  console.log('action send', socketId);
  connections.delete(socketId)
  chrome.sockets.tcp.close(socketId);
}