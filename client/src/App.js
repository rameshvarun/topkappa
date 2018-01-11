import React, { Component, Fragment, PureComponent } from "react";
import logo from "./logo.svg";
import "./App.css";

import MuiThemeProvider from "material-ui/styles/MuiThemeProvider";
import { Tabs, Tab } from "material-ui/Tabs";
import Slider from "material-ui/Slider";

import FontAwesomeIcon from "@fortawesome/react-fontawesome";
import faCaretUp from "@fortawesome/fontawesome-free-solid/faArrowUp";
import faInfoCircle from "@fortawesome/fontawesome-free-solid/faInfoCircle";
import faChevronDown from "@fortawesome/fontawesome-free-solid/faChevronDown";

import ReactTooltip from "react-tooltip";

const request = require("request-promise");
const queryString = require("query-string");
const tmi = require("tmi.js");

const uuidv4 = require("uuid/v4");

const log = require("loglevel");
window.log = log;

window.localStorage.user_id = window.localStorage.user_id || uuidv4();
const stringify = JSON.stringify;

const NEW_CHATS_MAX = 100;

const client = new tmi.client({
  connection: { reconnect: true, secure: true },
  channels: ["#gamesdonequick"]
});
client.connect();

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
    return <div className={`chat-badge-${name}`} />;
  }

  var chatBadges = [];

  if (!isBot) {
    if (user.username == chan) {
      chatBadges.push(createBadge("broadcaster"));
    }
    if (user["user-type"]) {
      chatBadges.push(createBadge(user["user-type"]));
    }
    if (user.turbo) {
      chatBadges.push(createBadge("turbo"));
    }
  } else {
    chatBadges.push(createBadge("bot"));
  }

  return <span className="chat-badges">{chatBadges}</span>;
}

function formatEmotes(text, emotes) {
  var splitText = text.split("");
  for (var i in emotes) {
    var e = emotes[i];
    for (var j in e) {
      var mote = e[j];
      if (typeof mote == "string") {
        mote = mote.split("-");
        mote = [parseInt(mote[0]), parseInt(mote[1])];
        var length = mote[1] - mote[0],
          empty = Array.apply(null, new Array(length + 1)).map(function() {
            return "";
          });
        splitText = splitText
          .slice(0, mote[0])
          .concat(empty)
          .concat(splitText.slice(mote[1] + 1, splitText.length));
        splitText.splice(
          mote[0],
          1,
          <img
            className="emoticon"
            src={`http://static-cdn.jtvnw.net/emoticons/v1/${i}/3.0`}
          />
        );
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
    let msg_id = this.props.userstate.id;
    let isUpvoted = window.localStorage["upvoted_" + msg_id];

    return (
      <div className="chat-line">
        {this.props.upvotes && (
          <span className="upvote-count">{this.props.upvotes}</span>
        )}

        <span
          className={"arrow " + (isUpvoted ? "upvoted" : "not-upvoted")}
          onClick={async () => {
            if (isUpvoted) return;

            let chat_id = this.props.userstate.id;
            await request({
              method: "POST",
              uri: `${API_ENDPOINT}/upvote`,
              json: true,
              qs: {
                id_token: window.localStorage.user_id,
                chat_id
              }
            });
            window.localStorage["upvoted_" + msg_id] = true;
            this.forceUpdate();
          }}
        >
          <FontAwesomeIcon icon={faCaretUp} size="lg" />
        </span>
        {badges(null, this.props.userstate, false)}
        <span className="chat-name">
          {this.props.userstate["display-name"]}
        </span>
        <span className="chat-colon" />
        <span className="chat-message">
          {formatEmotes(this.props.message, this.props.userstate.emotes)}
        </span>
      </div>
    );
  }
}

const API_ENDPOINT =
  process.env.NODE_ENV === "production"
    ? "https://d1nqfcql14qmqx.cloudfront.net"
    : "http://localhost:4000";
log.info("API Endpoint: %s.", API_ENDPOINT);

const TOP_CHAT_REFRESH_INTERVAL = 3 * 1000;

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      new_chats: [],
      top_chats: [],
      tab: "vote",
      new_visible: true
    };
  }

  async refreshTopChats() {
    let res = await request({
      uri: `${API_ENDPOINT}/top`,
      json: true
    });

    this.setState(prev => {
      prev.top_chats = res;
      return prev;
    });
  }

  async componentDidMount() {
    this.refreshTopChats();
    let topCheckInterval = setInterval(
      () => this.refreshTopChats(),
      TOP_CHAT_REFRESH_INTERVAL
    );

    let next_message_time = 0;
    client.on("chat", async (channel, userstate, message, self) => {
      log.debug("Chat message from %s: %s", userstate["display-name"], message);

      let current_time = new Date().getTime();
      if (current_time > next_message_time) {
        next_message_time =
          current_time + getRandomInt(CHAT_WAIT_MIN, CHAT_WAIT_MAX);
        this.setState(prev => {
          prev.new_chats.unshift({ userstate, message });
          while (prev.new_chats.length > NEW_CHATS_MAX) prev.new_chats.pop();
          return prev;
        });
      }
    });
  }
  render() {
    return (
      <Fragment>
        <MuiThemeProvider>
          <Tabs>
            <Tab
              label="TopKappa"
              onActive={() => {
                this.setState(prev => {
                  prev.tab = "vote";
                  return prev;
                });
              }}
            />
            <Tab
              label="All"
              onActive={() => {
                this.setState(prev => {
                  prev.tab = "all";
                  return prev;
                });
              }}
            />
          </Tabs>
        </MuiThemeProvider>
        <div
          id="chatbar"
          style={this.state.tab == "vote" ? {} : { display: "none" }}
        >
          <div class="chatbar-header">
            <span /> <span>Top</span>{" "}
            <span data-tip="Top upvoted chats will appear here.">
              <FontAwesomeIcon icon={faInfoCircle} />
            </span>{" "}
          </div>
          <div id="topchats">
            {(this.state.top_chats || []).map(chat => (
              <ChatLine
                upvotes={chat.upvotes}
                message={chat.message}
                userstate={chat.userstate}
              />
            ))}
          </div>
          <div class="chatbar-header">
            {this.state.new_visible && (
              <span
                onClick={() => {
                  this.setState(prev => {
                    prev.new_visible = false;
                    return prev;
                  });
                }}
              >
                <FontAwesomeIcon icon={faChevronDown} />
              </span>
            )}
            {!this.state.new_visible && (
              <span
                onClick={() => {
                  this.setState(prev => {
                    prev.new_visible = true;
                    return prev;
                  });
                }}
              >
                <FontAwesomeIcon icon={faChevronDown} />
              </span>
            )}
            <span>New</span>
            <span data-tip="Random new chats will appear here for you to upvote.">
              <FontAwesomeIcon icon={faInfoCircle} />
            </span>
          </div>
          {this.state.new_visible && (
            <div id="newchats">
              {this.state.new_chats.map(chat => (
                <ChatLine message={chat.message} userstate={chat.userstate} />
              ))}
            </div>
          )}
        </div>
        <iframe
          frameborder="0"
          scrolling="no"
          id="chat_embed"
          style={this.state.tab == "all" ? {} : { display: "none" }}
          src="https://www.twitch.tv/embed/gamesdonequick/chat"
        />
        <ReactTooltip />
      </Fragment>
    );
  }
}

export default App;
