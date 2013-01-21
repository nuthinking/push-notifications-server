var CONFIG = {
	debug : false,
	id : null // set in onConnect
// updated in the message-processing loop
};

// CUT ///////////////////////////////////////////////////////////////////
/*
 * This license and copyright apply to all code until the next "CUT"
 * http://github.com/jherdman/javascript-relative-time-helpers/
 * 
 * The MIT License
 * 
 * Copyright (c) 2009 James F. Herdman
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * 
 * 
 * Returns a description of this past date in relative terms. Takes an optional
 * parameter (default: 0) setting the threshold in ms which is considered "Just
 * now".
 * 
 * Examples, where new Date().toString() == "Mon Nov 23 2009 17:36:51 GMT-0500
 * (EST)":
 * 
 * new Date().toRelativeTime() --> 'Just now'
 * 
 * new Date("Nov 21, 2009").toRelativeTime() --> '2 days ago' // One second ago
 * new Date("Nov 23 2009 17:36:50 GMT-0500 (EST)").toRelativeTime() --> '1
 * second ago' // One second ago, now setting a now_threshold to 5 seconds new
 * Date("Nov 23 2009 17:36:50 GMT-0500 (EST)").toRelativeTime(5000) --> 'Just
 * now'
 * 
 */

function getURLParameter(name) {
	return decodeURI((RegExp(name + '=' + '(.+?)(&|$)').exec(location.search) || [
			, null ])[1]);
}

function log(str){
	if(window && window.console){
		window.console.log(str);
	}
}

Date.prototype.toRelativeTime = function(now_threshold) {
	var delta = new Date() - this;

	now_threshold = parseInt(now_threshold, 10);

	if (isNaN(now_threshold)) {
		now_threshold = 0;
	}

	if (delta <= now_threshold) {
		return 'Just now';
	}

	var units = null;
	var conversions = {
		millisecond : 1, // ms -> ms
		second : 1000, // ms -> sec
		minute : 60, // sec -> min
		hour : 60, // min -> hour
		day : 24, // hour -> day
		month : 30, // day -> month (roughly)
		year : 12
	// month -> year
	};

	for ( var key in conversions) {
		if (delta < conversions[key]) {
			break;
		} else {
			units = key; // keeps track of the selected key over the
			// iteration
			delta = delta / conversions[key];
		}
	}

	// pluralize a unit when the difference is greater than 1.
	delta = Math.floor(delta);
	if (delta !== 1) {
		units += "s";
	}
	return [ delta, units ].join(" ");
};

/*
 * Wraps up a common pattern used with this plugin whereby you take a String
 * representation of a Date, and want back a date object.
 */
Date.fromString = function(str) {
	return new Date(Date.parse(str));
};

// CUT ///////////////////////////////////////////////////////////////////

// updates the users link to reflect the number of active users
function updateUsersLink() {
	var t = nicks.length.toString() + " user";
	if (nicks.length != 1)
		t += "s";
	$("#usersLink").text(t);
}

// utility functions

var messageId = null;

util = {
	urlRE : /https?:\/\/([-\w\.]+)+(:\d+)?(\/([^\s]*(\?\S+)?)?)?/g,

	// html sanitizer
	toStaticHTML : function(inputHtml) {
		inputHtml = inputHtml.toString();
		return inputHtml.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(
				/>/g, "&gt;");
	},

	// pads n with zeros on the left,
	// digits is minimum length of output
	// zeroPad(3, 5); returns "005"
	// zeroPad(2, 500); returns "500"
	zeroPad : function(digits, n) {
		n = n.toString();
		while (n.length < digits)
			n = '0' + n;
		return n;
	},

	// it is almost 8 o'clock PM here
	// timeString(new Date); returns "19:49"
	timeString : function(date) {
		var minutes = date.getMinutes().toString();
		var hours = date.getHours().toString();
		return this.zeroPad(2, hours) + ":" + this.zeroPad(2, minutes);
	},

	// does the argument only contain whitespace?
	isBlank : function(text) {
		var blank = /^\s*$/;
		return (text.match(blank) !== null);
	}
};

var transmission_errors = 0;
//daemon memory usage
var rss;
var room;
var clientName;

// process updates if we have any, request updates from the server,
// and call again with response. the last part is like recursion except the call
// is being made from the response handler, and not at some point during the
// function's execution.
function longPoll(data) {
	if (transmission_errors > 2) {
		alert("conenction errors: refresh the page");
		return;
	}
	
	// update memory resources
	if (data && data.rss) {
		rss = data.rss;
		updateRSS();
	}

	// process any updates we may have
	if(data && data.id){
		CONFIG.id = data.id;
		setLabel("user: " + CONFIG.id);
	}
	// data will be null on the first call of longPoll
	if (data && data.type) {
		messageId = data.type;
		log("received message type: " + messageId);
		updateMessage();
		if (window.qml && window.qml.addMessage) {
			window.qml.addMessage(messageId);
		}
	}

	log("do longPoll");
	// make another request
	$.ajax( {
		cache : false,
		type : "GET",
		url : "/recv",
		dataType : "json",
		data : {
			room: room,
			clientName: clientName,
			id : CONFIG.id,
			messageId : messageId
		},
		error : function() {
			log("long poll error. trying again...");
			transmission_errors += 1;
			// don't flood the servers on error, wait 10 seconds before retrying
			setTimeout(longPoll, 10 * 1000);
		},
		success : function(data) {
			log("   on poll data");
			transmission_errors = 0;
				// if everything went well, begin another request immediately
			// the server will take a long time to respond
			// how long? well, it will wait until there is another message
			// and then it will return it to us and close the connection.
			// since the connection is closed when we get data, we longPoll again
			longPoll(data);
		}
	});
}
// submit a new message to the server
function send(id) {
	log("send: " + id);
	jQuery.get("/send", {
		room : room,
		id : CONFIG.id,
		messageId : id
	}, function (data) { }, "json");
}


// transition the page to the loading screen
function showLoad() {
	$("#loading").show();
	$("#toolbar").hide();
}

// transition the page to the main chat view, putting the cursor in the
// textfield
function showUI() {
	$("#toolbar").show();
}


$(document).ready(function() {
	log("ready");
	// make the actual join request to the server
	room = getURLParameter("room");
	if(room == null || room == 'null'){
		alert("no room specified!");
		return;
	}
	clientName = getURLParameter("clientName");
	if (clientName == null || clientName == 'null') {
		alert("no name provided for push connection");
		clientName = "undefined";
	}
	// submit new messages when the user hits enter if the message isnt blank
	$(document).keypress(function(e) {
		var keyCode = e.charCode || e.keyCode;
		var str = String.fromCharCode(keyCode);
		send(str);
	});
	longPoll();
});


// if we can, notify the server that we're going away.
$(window).unload(function() {
	jQuery.get("/part", {
		room: room,
		id : CONFIG.id
	}, function(data) {
	}, "json");
});

function updateRSS() {
	var bytes = parseInt(rss);
	if (bytes) {
		var megabytes = bytes / (1024 * 1024);
		megabytes = Math.round(megabytes * 10) / 10;
		$("#rss").text(megabytes.toString());
	}
}

function updateMessage()
{
	setLabel(messageId);
	if(window.addMessage)
	{
		window.addMessage(messageId);
	}
}

function setLabel(str){
	$("#loading").html(str);
}