import React, { Component, Fragment, PureComponent } from 'react';
import logo from './logo.svg';
import './App.css';

import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';
import {Tabs, Tab} from 'material-ui/Tabs';
import Slider from 'material-ui/Slider';

import FontAwesomeIcon from '@fortawesome/react-fontawesome'
import faCaretUp from '@fortawesome/fontawesome-free-solid/faArrowUp'

const request = require('request-promise');
const queryString = require('query-string');
const tmi = require("tmi.js");

const uuidv4 = require('uuid/v4');

const log = require('loglevel');
window.log = log;

window.localStorage.user_id = (window.localStorage.user_id || uuidv4());
const stringify = JSON.stringify;

const NEW_CHATS_MAX = 100;

const client = new tmi.client({
	connection: { reconnect: true },
	channels: ["#gamesdonequick"]
});
client.connect();

const UPVOTED_SET = new Set();

const CHAT_WAIT_MIN = 2 * 1000;
const CHAT_WAIT_MAX = 3 * 1000;

/**
 * Returns a random integer between min (inclusive) and max (inclusive)
 * Using Math.round() will give you a non-uniform distribution!
 */
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

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


class ChatLine extends React.Component {
  constructor(props) {
    super(props);
}

  render() {
    return <div className='chat-line'>
      {
        this.props.upvotes && <span>{this.props.upvotes}</span>
      }

      <span className={UPVOTED_SET.has(this.props.userstate.id) ? "upvoted" : "not-upvoted"} onClick={async () => {
				let chat_id = this.props.userstate.id;
        await request({
          method: 'POST',
          uri: `${API_ENDPOINT}/upvote`,
          json: true,
          qs: {
            id_token: window.localStorage.user_id,
            chat_id,
          }
        });
        UPVOTED_SET.add(chat_id);
        this.forceUpdate();
      }}>
        <FontAwesomeIcon icon={faCaretUp} size="lg" />
      </span>
      {badges(null, this.props.userstate, false)}
      <span className='chat-name'>{this.props.userstate['display-name']}</span>
      <span className='chat-colon'></span>
      <span className='chat-message'>{formatEmotes(this.props.message, this.props.userstate.emotes)}</span>
    </div>;
  }
}

const API_ENDPOINT = "http://ec2-52-204-196-54.compute-1.amazonaws.com";
const TOP_CHAT_REFRESH_INTERVAL = 5 * 1000;


class App extends Component {
  constructor(props) {
    super(props);
    this.state = { new_chats: [], top_chats: [], tab: 'vote' };
}

async refreshTopChats() {
  let res = await request({
    uri: `${API_ENDPOINT}/top`,
    json: true,
  });

  this.setState(prev => {
    prev.top_chats = res;
    return prev;
  });
}

  async componentDidMount() {
    this.refreshTopChats();
    let topCheckInterval = setInterval(() => this.refreshTopChats(), TOP_CHAT_REFRESH_INTERVAL);

		let next_message_time = 0;
     client.on("chat", async (channel, userstate, message, self) => {
       log.debug("Chat message from %s: %s", userstate['display-name'], message);

			 let current_time = (new Date()).getTime();
       if (current_time > next_message_time) {
				 next_message_time = current_time + getRandomInt(CHAT_WAIT_MIN, CHAT_WAIT_MAX);
        this.setState((prev) => {
          prev.new_chats.push({ userstate, message });
          prev.new_chats = prev.new_chats.slice(Math.max(prev.new_chats.length - NEW_CHATS_MAX, 0));
          return prev;
        });
       }
     });
  }
  render() {
    return (
			<MuiThemeProvider>
				<Tabs>
					<Tab label="TopKappa" onActive={() => {
						this.setState(prev => {
							prev.tab = "vote";
							return prev;
						})
					}}>

					</Tab>
					<Tab label="All" onActive={() => {
						this.setState(prev => {
							prev.tab = "all";
							return prev;
						})
					}}>

					</Tab>
				</Tabs>

					<div id="chatbar" style={ this.state.tab == "vote" ? {} : {display: 'none'} }>
						<div class="chatbar-header">Top</div>
						<div id="topchats">
							{ (this.state.top_chats || []).map(chat => <ChatLine upvotes={chat.upvotes} message={chat.message} userstate={chat.userstate} />) }
						</div>
						<div class="chatbar-header">New</div>
						<div id="newchats">
							{ this.state.new_chats.map(chat => <ChatLine message={chat.message} userstate={chat.userstate} />) }
						</div>
					</div>
					<iframe frameborder="0"
								scrolling="no"
								id="chat_embed"
								style={ this.state.tab == "all" ? {} : {display: 'none'} }
								src="https://www.twitch.tv/embed/gamesdonequick/chat">
					</iframe>
			</MuiThemeProvider>




    );
  }
}

export default App;
