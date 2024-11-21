const express = require('express');
const passport = require('passport');
const { Strategy: TwitterStrategy } = require('passport-twitter');
const jsonwebtoken = require('jsonwebtoken');
const cors = require('cors');
const dotenv = require('dotenv');
const expressSession = require('express-session');
const serverless = require('serverless-http');

dotenv.config();

const app = express();

// CORS configuration
app.use(
    cors({
        origin: process.env.FRONTEND_BASE_URL || 'http://localhost:5173', // Frontend URL
        credentials: true,
        // methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        // allowedHeaders: ['Content-Type', 'Authorization'],
    }),
);

// Session middleware configuration
app.use(
    expressSession({
        secret: process.env.SESSION_SECRET, // Use a strong secret in production
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: false, // Set to true if your app is served over HTTPS
            httpOnly: true,
            sameSite: 'lax',
        },
    }),
);

// Passport configuration
passport.use(
    new TwitterStrategy(
        {
            consumerKey: process.env.TWITTER_CONSUMER_KEY, // API Key
            consumerSecret: process.env.TWITTER_CONSUMER_SECRET, // API Secret Key
            callbackURL: process.env.TWITTER_CALLBACK_URL || '/auth/twitter/callback',
        },
        function (token, tokenSecret, profile, cb) {
            // Here you can save the user info to your database if needed
            return cb(null, profile);
        },
    ),
);

passport.serializeUser(function (user, cb) {
    cb(null, user);
});

passport.deserializeUser(function (obj, cb) {
    cb(null, obj);
});

// Initialize Passport
app.use(passport.initialize());

app.use(passport.session());

// Routes
app.get('/auth/twitter', passport.authenticate('twitter'));

app.get(
    '/auth/twitter/callback',
    passport.authenticate('twitter', { failureRedirect: process.env.FRONTEND_BASE_URL || 'http://localhost:5173' }),
    function (req, res) {
        // Successful authentication
        const user = req.user;
        const token = jsonwebtoken.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, {
            expiresIn: '1h',
        });
        // res.redirect(`http://localhost:5173?token=${token}`);
        // res.send(`
        //     <script>
        //       window.opener.postMessage({
        //         token: '${token}',
        //         twitterProfileUrl: 'https://x.com/${process.env.REDIRECT_TWITTER_PROFILE || 'XAlphaAI_Team'}'
        //       }, '*');
        //       window.close();
        //     </script>
        //   `);

        // res.status(200).json({
        //   status: 'success',
        //   token: token,
        //   user: {
        //     id: user.id,
        //     username: user.username,
        //     displayName: user.displayName,
        //     photos: user.photos,
        //   },
        //   session: req.session,
        // });

        let isTelegram = 'WEB';
        isTelegram = process.env.PLATFORM === 'TELEGRAM';

        const REDIRECTING_ROUTE = process.env.REDIRECTING_ROUTE || 'profile';

        req.session.user = {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            photos: user.photos,
        };

        if (isTelegram) {
            // Send script for Telegram Web App
            res.send(`
              <script>
                  const token = '${token}';
                  const user = {
                      id: '${user.id}',
                      username: '${user.username}',
                      displayName: '${user.displayName}',
                      photos: ${JSON.stringify(user.photos)},
                  };
                  window.Telegram.WebApp.postEvent('authComplete', { token, user });
                  window.Telegram.WebApp.close();
              </script>
          `);
        } else {
            // Redirect with token and user details passed as query parameters
            const redirectUrl = `${
                process.env.FRONTEND_BASE_URL || 'http://localhost:5173'
            }/${REDIRECTING_ROUTE}?token=${encodeURIComponent(token)}&username=${encodeURIComponent(user.username)}`;
            res.redirect(redirectUrl);
        }
    },
);

// Start the server
app.listen(5000, () => {
    console.log('Backend server is running on port 5000');
});

module.exports.handler = serverless(app);
