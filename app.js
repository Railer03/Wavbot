// app.js, es la parte logica de la aplicacion. lo mas importante seria los get que establecen como era la pagina una vez son 
//clickeado los botones html
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const path = require('path');
const { Client, GatewayIntentBits } = require('discord.js');

// Inicializa el cliente del bot
const bot = new Client({
    intents: [GatewayIntentBits.Guilds]
});

bot.login(process.env.BOT_TOKEN);//Inicializar bot

bot.once('ready', () => {
    console.log(`Bot iniciado como ${bot.user.tag}`);
});


function ensureBotReady(req, res, next) {
    if (!bot.readyAt) {
        return res.status(503).send('El bot aún no está listo. Intenta más tarde.');
    }
    next();
}

const app = express();
const port = 3000;

// Configuración de la sesión
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
}));

// Configuración de Passport para autenticación con Discord
passport.use(new Strategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.REDIRECT_URI,
    scope: ['identify', 'guilds']
}, function(accessToken, refreshToken, profile, done) {
    return done(null, profile);
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

app.use(passport.initialize());
app.use(passport.session());

// Sirve archivos estáticos
app.use(express.static('public'));

// Configuración de EJS como motor de plantillas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware de autenticación
function checkAuth(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.redirect('/login');
}

// Ruta de inicio
app.get('/', (req, res) => {
    res.render('index', { user: req.user });
});

// Ruta de login con Discord
app.get('/login', passport.authenticate('discord'));

// Callback de OAuth2
app.get('/auth/discord/callback', passport.authenticate('discord', {
    failureRedirect: '/'
}), (req, res) => {
    res.redirect('/dashboard');
});

// Ruta del dashboard (requiere autenticación)
app.get('/dashboard', checkAuth, ensureBotReady, (req, res) => {
    const botGuildIds = bot.guilds.cache.map(guild => guild.id);

    // Filtra los servidores donde el usuario es admin y el bot está presente
    const adminAndBotGuilds = req.user.guilds.filter(guild => {
        const isAdmin = (guild.permissions & 0x20) === 0x20; // Verifica si el usuario es administrador
        const botIsInGuild = botGuildIds.includes(guild.id); // Verifica si el bot está en el servidor
        return isAdmin && botIsInGuild;
    });

    res.render('dashboard', { user: req.user, adminGuilds: adminAndBotGuilds });
});

// Ruta de logout
app.get('/logout', (req, res, next) => {
    req.logout(err => {
        if (err) {
            console.error('Error al cerrar sesión:', err);
            return next(err);
        }
        res.redirect('/');
    });
});

// Ruta para mostrar detalles de un servidor específico
app.get('/server/:id', checkAuth, ensureBotReady, (req, res) => {
    const guildId = req.params.id;
    const guild = req.user.guilds.find(g => g.id === guildId);

    if (!guild || (guild.permissions & 0x20) !== 0x20) {
        return res.status(403).send('No tienes permisos de administrador en este servidor.');
    }

    res.render('server', { user: req.user, guild });
});

app.listen(port, () => {
    console.log(`Servidor iniciado en http://localhost:${port}`);
});
