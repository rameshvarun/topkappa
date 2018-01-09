import React, { Component, Fragment, PureComponent } from 'react';
import logo from './logo.svg';
import './App.css';

const queryString = require('query-string');
const tmi = require("tmi.js");

const log = require('loglevel');
window.log = log;

const parsedHash = queryString.parse(window.location.hash);
console.log(parsedHash);

const stringify = JSON.stringify;

const NEW_CHATS_MAX = 100;

const client = new tmi.client({
    channels: ["#gamesdonequick"]
});

client.connect();

var socket = require('engine.io-client')('ws://localhost:4000');
socket.on('open', function(){
  if (parsedHash.id_token) {
    socket.send(stringify({
      type: 'id-token',
      token: parsedHash.id_token
    }));

  }
  socket.on('message', function(data){
    console.log(data);
  });
  socket.on('close', function(){
    console.log("Socket closed...");
  });
});

function badges(chan, user, isBot) {
	function createBadge(name) {
		return <div className={`chat-badge-${name}`}></div>;
	}

	var chatBadges = [];

	if(!isBot) {
		if(user.username == chan) {
			chatBadges.push(createBadge('broadcaster'));
		}
		if(user['user-type']) {
			chatBadges.push(createBadge(user['user-type']));
		}
		if(user.turbo) {
			chatBadges.push(createBadge('turbo'));
		}
	}
	else {
		chatBadges.push(createBadge('bot'));
	}

	return <span className='chat-badges'>
    {chatBadges}
  </span>;
}

function formatEmotes(text, emotes) {
	var splitText = text.split('');
	for(var i in emotes) {
		var e = emotes[i];
		for(var j in e) {
			var mote = e[j];
			if(typeof mote == 'string') {
				mote = mote.split('-');
				mote = [parseInt(mote[0]), parseInt(mote[1])];
				var length =  mote[1] - mote[0],
					empty = Array.apply(null, new Array(length + 1)).map(function() { return '' });
				splitText = splitText.slice(0, mote[0]).concat(empty).concat(splitText.slice(mote[1] + 1, splitText.length));
				splitText.splice(mote[0], 1, <img className="emoticon" src={`http://static-cdn.jtvnw.net/emoticons/v1/${i}/3.0`} />);
			}
		}
	}
	return splitText;
}


class ChatLine extends React.PureComponent {
  render() {
    return <div className='chat-line'>
      <button onClick={() => {
        socket.send(stringify({ type: "upvote", id: this.props.userstate.id }));
      }}>UPVOTE </button>
      {badges(null, this.props.userstate, false)}
      <span className='chat-name'>{this.props.userstate['display-name']}</span>
      <span className='chat-colon'></span>
      <span className='chat-message'>{formatEmotes(this.props.message, this.props.userstate.emotes)}</span>
    </div>;
  }
}

class App extends Component {
  constructor(props) {
    super(props);
    this.state = { new_chats: [] };
}

  async componentDidMount() {
     client.on("chat", async (channel, userstate, message, self) => {
       log.debug("Chat message from %s: %s", userstate['display-name'], message);

       //if (Math.random() < 0.5) {
        this.setState((prev) => {
          prev.new_chats.push({ userstate, message });
          prev.new_chats = prev.new_chats.slice(Math.max(prev.new_chats.length - NEW_CHATS_MAX, 0));
          return prev;
        });
       //}
     });
  }
  render() {
    return (
      <div>
        <div>
          { !parsedHash.id_token &&
              <a href="https://api.twitch.tv/kraken/oauth2/authorize?client_id=kd9kqzvl8bbvw8mlft13rdklxi9w05&redirect_uri=http://localhost:3000&response_type=token%20id_token&scope=openid%20chat_login"><img src="http://ttv-api.s3.amazonaws.com/assets/connect_dark.png" className="twitch-connect" href="#" /></a>
          }
        </div>
        <div>
          { this.state.new_chats.map(chat => <ChatLine message={chat.message} userstate={chat.userstate} />) }
        </div>
      </div>
    );
  }
}

export default App;
