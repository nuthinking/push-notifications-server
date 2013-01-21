HOST = null; // localhost
PORT = 31267;

// when the daemon started
var starttime = (new Date()).getTime();

var mem = process.memoryUsage();
// every 10 seconds poll for the memory.
setInterval(function() {
	mem = process.memoryUsage();
}, 10 * 1000);

var fu = require("./fu"), sys = require("sys"), url = require("url"), qs = require("querystring");

var SESSION_TIMEOUT = 60 * 1000 * 60;

var messageId = -1;

var rooms = {};
function getRoomById(id){
	var room = rooms[id];
	if(!room){
		room = {
			sessions: {},
			callbacks: [],
			createSession: function(name){
				var room = this;
				var session = {
					id : Math.floor(Math.random() * 99999999999).toString(),
					name : name,
					timestamp: new Date(),

				    poke: function () {
				      session.timestamp = new Date();
				    },
	    
					destroy : function() {
						delete room.sessions[session.id];
					}
				};

				room.sessions[session.id] = session;
				return session;
			}
		};
		rooms[id] = room;
	}
	return room;
}

// interval to kill off old sessions
/*setInterval(function() {
	var now = new Date();
	for ( var id in sessions) {
		if (!sessions.hasOwnProperty(id))
			continue;
		var session = sessions[id];

		if (now - session.timestamp > SESSION_TIMEOUT) {
			session.destroy();
		}
	}
}, 1000);*/

setInterval(function() {
	// close out requests older than 30 seconds
	var expiration = new Date().getTime() - 30000;
	var response;
	for (var j in rooms){
		if(rooms.hasOwnProperty(j))
        {
			// sys.puts("clear room: " + j);
			var room = rooms[j];
			for (var i = room.callbacks.length - 1; i >= 0; i--) {
				if (room.callbacks[i].timestamp < expiration) {
					response = room.callbacks[i].response;
					room.callbacks.splice(i, 1);
					response(null);
				}
			}
        }
	}
	
}, 1000);

fu.listen(Number(process.env.PORT || PORT), HOST);

fu.get("/", fu.staticHandler("index.html"));
fu.get("/style.css", fu.staticHandler("style.css"));
fu.get("/client.js", fu.staticHandler("client.js"));
fu.get("/jquery-1.2.6.min.js", fu.staticHandler("jquery-1.2.6.min.js"));
fu.get("/crossdomain.xml", fu.staticHandler("crossdomain.xml"));

fu.get("/part", function(req, res) {
	var id = qs.parse(url.parse(req.url).query).id;
	var roomId = qs.parse(url.parse(req.url).query).room;
	var room = getRoomById(roomId);
	
	var session;
	if (id && room.sessions[id]) {
		session = room.sessions[id];
		session.destroy();
	}
	res.simpleJSON(200, {
		rss : mem.rss
	});
});

fu.get("/recv", function(req, res) {
	var id = qs.parse(url.parse(req.url).query).id;
	var roomId = qs.parse(url.parse(req.url).query).room;
	var room = getRoomById(roomId);
	
	var session;
	if (id && room.sessions[id]) {
		session = room.sessions[id];
		session.poke();
		sys.puts("recv - id: " + session.name);
	}else{
		sys.puts("recv - new client");
		var clientName = qs.parse(url.parse(req.url).query).clientName;
		session = room.createSession(clientName);
		sys.puts("joined: " + session.name);
		res.simpleJSON(200, {
			id: session.id,
			rss : mem.rss
		});
		return;
	}
	room.callbacks.push({
		response: function (newId){
			res.simpleJSON(200, {
				type: newId,
				rss : mem.rss
			})},
		timestamp: new Date().getTime()
	});
	sys.puts("callbacks length: " + room.callbacks.length);
});

fu.get("/send", function(req, res) {
	var id = qs.parse(url.parse(req.url).query).id;
	var roomId = qs.parse(url.parse(req.url).query).room;
	var room = getRoomById(roomId);
	messageId = qs.parse(url.parse(req.url).query).messageId;
	sys.puts("send: " + messageId);

	var session = room.sessions[id];
	if (!session) {
		sys.puts("no session!");
		res.simpleJSON(400, {
			error : "No such session id"
		});
		return;
	}
	res.simpleJSON(200, {
		rss : mem.rss
	});
	session.poke();
	sys.puts("dispatch to all");
	while (room.callbacks.length > 0) {
		var cb = room.callbacks.shift();
		cb.response(messageId);
	}
	sys.puts("callbacks length: " + room.callbacks.length);
});
