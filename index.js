'use strict';

const config = require('./config');
const bodyParser = require('body-parser');
const express = require('express');
const Wit = require('node-wit').Wit;
const FB = require('./facebook.action');
const request = require('request');

// Webserver parameter
const PORT = process.env.PORT || 5000;

// Messenger API parameters
if (!config.FB_PAGE_ID) {
    throw new Error('missing FB_PAGE_ID');
}
if (!config.FB_PAGE_TOKEN) {
    throw new Error('missing FB_PAGE_TOKEN');
}

// See the Webhook reference
// https://developers.facebook.com/docs/messenger-platform/webhook-reference
const getFirstMessagingEntry = (body) => {
    const val = body.object == 'page' &&
            body.entry &&
            Array.isArray(body.entry) &&
            body.entry.length > 0 &&
            body.entry[0] &&
            body.entry[0].id === config.FB_PAGE_ID &&
            body.entry[0].messaging &&
            Array.isArray(body.entry[0].messaging) &&
            body.entry[0].messaging.length > 0 &&
            body.entry[0].messaging[0]
        ;
    return val || null;
};

const sessions = {};
const findOrCreateSession = (sessions, fbid, cb) => {

    if (!sessions[fbid]) {
        console.log("New Session for:", fbid);
        sessions[fbid] = {
            fbid: fbid,
            context: {},
            respond: true
        };
    }
    cb(sessions, fbid);

};

// Wit.ai bot specific code

// Import our bot actions and setting everything up
const actions = require('./wit.actions');
const wit = new Wit(config.WIT_TOKEN, actions);

// Starting our webserver and putting it all together
const app = express();
app.set('port', PORT);
app.listen(app.get('port'));
app.use(bodyParser.json());

// Webhook setup
app.get('/', (req, res) => {
    if (!config.FB_VERIFY_TOKEN) {
        throw new Error('missing FB_VERIFY_TOKEN');
    }
    if (req.query['hub.mode'] === 'subscribe' &&
        req.query['hub.verify_token'] === config.FB_VERIFY_TOKEN) {
        res.send(req.query['hub.challenge']);
    } else {
        res.sendStatus(400);
    }
});

// Message handler
app.post('/', (req, res) => {
    // Parsing the Messenger API response
    const messaging = getFirstMessagingEntry(req.body);
    if (messaging && messaging.recipient.id === config.FB_PAGE_ID) {
        // Yay! We got a new message!

        // We retrieve the Facebook user ID of the sender
        const sender = messaging.sender.id;

        // We retrieve the user's current session, or create one if it doesn't exist
        // This is needed for our bot to figure out the conversation history
        findOrCreateSession(sessions, sender, (sessions, sessionId) => {
            // We retrieve the message content

            if (messaging.message && sessions[sender].respond) {
                //MESSAGE

                const msg = messaging.message.text;
                const atts = messaging.message.attachments;

                if (atts) {
                    // We received an attachment

                    // Let's reply with an automatic message
                    FB.sendText(
                        sender,
                        'Sorry I can only process text messages for now.'
                    );
                } else if (msg) {
                    // We received a text message


                    //Check if user is angry
                    const watsonUrl = 'https://gateway-a.watsonplatform.net/calls/text/TextGetEmotion?apikey=' +
                        config.WATSON_KEY +
                        '&text=' + msg +
                        '&outputMode=json';
                    
                    request(watsonUrl, function (error, response, body) {
                        if (!error && response.statusCode == 200) {

                            //Todo: implement try catch
                            body = JSON.parse(body);

                            if(body.docEmotions.anger && body.docEmotions.anger >= 0.5 && false){
                                console.log('Forward to Agent');
                                FB.sendText(
                                    sender,
                                    'You will be forwarded to a real person, sorry to disappoint you :('
                                );

                                sessions[sender].respond = false;

                            }else{
                                // Let's forward the message to the Wit.ai Bot Engine
                                // This will run all actions until our bot has nothing left to do
                                wit.runActions(
                                    sessionId, // the user's current session
                                    msg, // the user's message
                                    sessions[sessionId].context, // the user's current session state
                                    (error, context) => {
                                        if (error) {
                                            console.log('Oops! Got an error from Wit:', error);
                                        } else {
                                            // Our bot did everything it has to do.
                                            // Now it's waiting for further messages to proceed.
                                            console.log('Waiting for futher messages.');

                                            // Based on the session state, you might want to reset the session.
                                            // This depends heavily on the business logic of your bot.
                                            // Example:
                                            // if (context['done']) {
                                            //   delete sessions[sessionId];
                                            // }

                                            // Updating the user's current session state
                                            sessions[sessionId].context = context;
                                            //connection.query("UPDATE session SET context=? WHERE fbid=?", [JSON.stringify(sessions[sessionId]), sessionId]);
                                        }
                                    }
                                );
                            }

                        }
                    });
                }
            } else if (messaging.postback) {
                //POSTBACK
                const postback = messaging.postback;

                if (postback) {
                    var context = sessions[sessionId].context;
                    FB.handlePostback(sessionId, context, postback.payload);
                }
            } else {
                //delivery confirmation
                //mids etc
            }
        });
    }
    res.sendStatus(200);
});
