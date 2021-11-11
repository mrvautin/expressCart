const fs = require('fs');
const yenv = require('yenv');
if(fs.existsSync('./env.yaml')){
    process.env = yenv('env.yaml', { strict: false });
}
const path = require('path');
const express = require('express');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const moment = require('moment');
const _ = require('lodash');
const MongoStore = require('connect-mongodb-session')(session);
const numeral = require('numeral');
const helmet = require('helmet');
const colors = require('colors');
const cron = require('node-cron');
const crypto = require('crypto');
const { getConfig, getPaymentConfig, updateConfigLocal } = require('./lib/config');
const { runIndexing } = require('./lib/indexing');
const { addSchemas } = require('./lib/schema');
const { initDb, getDbUri } = require('./lib/db');
const { writeGoogleData } = require('./lib/googledata');
let handlebars = require('express-handlebars');
const i18n = require('i18n');

// Validate our settings schema
const Ajv = require('ajv');
const ajv = new Ajv({ useDefaults: true });

// get config
const config = getConfig();

const baseConfig = ajv.validate(require('./config/settingsSchema'), config);
if(baseConfig === false){
    console.log(colors.red(`settings.json incorrect: ${ajv.errorsText()}`));
    process.exit(2);
}

// Validate the payment gateway config
_.forEach(config.paymentGateway, (gateway) => {
    if(ajv.validate(
            require(`./config/payment/schema/${gateway}`),
            require(`./config/payment/config/${gateway}`)) === false
        ){
        console.log(colors.red(`${gateway} config is incorrect: ${ajv.errorsText()}`));
        process.exit(2);
    }
});

// require the routes
const index = require('./routes/index');
const admin = require('./routes/admin');
const product = require('./routes/product');
const customer = require('./routes/customer');
const order = require('./routes/order');
const user = require('./routes/user');
const transactions = require('./routes/transactions');
const reviews = require('./routes/reviews');

const app = express();

// Language initialize
i18n.configure({
    locales: config.availableLanguages,
    defaultLocale: config.defaultLocale,
    cookie: 'locale',
    queryParameter: 'lang',
    directory: `${__dirname}/locales`,
    directoryPermissions: '755',
    api: {
        __: '__', // now req.__ becomes req.__
        __n: '__n' // and req.__n can be called as req.__n
    }
});

// view engine setup
app.set('views', path.join(__dirname, '/views'));
app.engine('hbs', handlebars({
    extname: 'hbs',
    layoutsDir: path.join(__dirname, 'views', 'layouts'),
    defaultLayout: 'layout.hbs',
    partialsDir: [path.join(__dirname, 'views')]
}));
app.set('view engine', 'hbs');

// helpers for the handlebar templating platform
handlebars = handlebars.create({
    helpers: {
        // Language helper
        __: () => { return i18n.__(this, arguments); }, // eslint-disable-line no-undef
        __n: () => { return i18n.__n(this, arguments); }, // eslint-disable-line no-undef
        availableLanguages: (block) => {
            let total = '';
            for(const lang of i18n.getLocales()){
                total += block.fn(lang);
            }
            return total;
        },
        partial: (provider) => {
            return `partials/payments/${provider}`;
        },
        perRowClass: (numProducts) => {
            if(parseInt(numProducts) === 1){
                return 'col-6 col-md-12 product-item';
            }
            if(parseInt(numProducts) === 2){
                return 'col-6 col-md-6 product-item';
            }
            if(parseInt(numProducts) === 3){
                return 'col-6 col-md-4 product-item';
            }
            if(parseInt(numProducts) === 4){
                return 'col-6 col-md-3 product-item';
            }

            return 'col-md-6 product-item';
        },
        menuMatch: (title, search) => {
            if(!title || !search){
                return '';
            }
            if(title.toLowerCase().startsWith(search.toLowerCase())){
                return 'class="navActive"';
            }
            return '';
        },
        getTheme: (view) => {
            return `themes/${config.theme}/${view}`;
        },
        formatAmount: (amt) => {
            if(amt){
                return numeral(amt).format('0.00');
            }
            return '0.00';
        },
        amountNoDecimal: (amt) => {
            if(amt){
                return handlebars.helpers.formatAmount(amt).replace('.', '');
            }
            return handlebars.helpers.formatAmount(amt);
        },
        getStatusColor: (status) => {
            switch(status){
                case 'Paid':
                    return 'success';
                case 'Approved':
                    return 'success';
                case 'Approved - Processing':
                    return 'success';
                case 'Failed':
                    return 'danger';
                case 'Completed':
                    return 'success';
                case 'Shipped':
                    return 'success';
                case 'Pending':
                    return 'warning';
                default:
                    return 'danger';
            }
        },
        checkProductVariants: (variants) => {
            if(variants && variants.length > 0){
                return 'true';
            }
            return 'false';
        },
        currencySymbol: (value) => {
            if(typeof value === 'undefined' || value === ''){
                return '$';
            }
            return value;
        },
        objectLength: (obj) => {
            if(obj){
                return Object.keys(obj).length;
            }
            return 0;
        },
        stringify: (obj) => {
            if(obj){
                return JSON.stringify(obj);
            }
            return '';
        },
        checkedState: (state) => {
            if(state === 'true' || state === true){
                return 'checked';
            }
            return '';
        },
        selectState: (state, value) => {
            if(state === value){
                return 'selected';
            }
            return '';
        },
        isNull: (value, options) => {
            if(typeof value === 'undefined' || value === ''){
                return options.fn(this);
            }
            return options.inverse(this);
        },
        toLower: (value) => {
            if(value){
                return value.toLowerCase();
            }
            return null;
        },
        formatDate: (date, format) => {
            return moment(date).format(format);
        },
        discountExpiry: (start, end) => {
            return moment().isBetween(moment(start), moment(end));
        },
        ifCond: (v1, operator, v2, options) => {
            switch(operator){
                case '==':
                    return (v1 === v2) ? options.fn(this) : options.inverse(this);
                case '!=':
                    return (v1 !== v2) ? options.fn(this) : options.inverse(this);
                case '===':
                    return (v1 === v2) ? options.fn(this) : options.inverse(this);
                case '<':
                    return (v1 < v2) ? options.fn(this) : options.inverse(this);
                case '<=':
                    return (v1 <= v2) ? options.fn(this) : options.inverse(this);
                case '>':
                    return (v1 > v2) ? options.fn(this) : options.inverse(this);
                case '>=':
                    return (v1 >= v2) ? options.fn(this) : options.inverse(this);
                case '&&':
                    return (v1 && v2) ? options.fn(this) : options.inverse(this);
                case '||':
                    return (v1 || v2) ? options.fn(this) : options.inverse(this);
                default:
                    return options.inverse(this);
            }
        },
        isAnAdmin: (value, options) => {
            if(value === 'true' || value === true){
                return options.fn(this);
            }
            return options.inverse(this);
        },
        paymentMessage: (status) => {
            if(status === 'Paid'){
                return '<h2 class="text-success">Your payment has been successfully processed</h2>';
            }
            if(status === 'Pending'){
                const paymentConfig = getPaymentConfig();
                if(config.paymentGateway === 'instore'){
                    return `<h2 class="text-warning">${paymentConfig.resultMessage}</h2>`;
                }
                return '<h2 class="text-warning">The payment for this order is pending. We will be in contact shortly.</h2>';
            }
            return '<h2 class="text-danger">Your payment has failed. Please try again or contact us.</h2>';
        },
        paymentOutcome: (status) => {
            if(status === 'Paid' || status === 'Pending'){
                return '<h5 class="text-warning">Please retain the details above as a reference of payment</h5>';
            }
            return '';
        },
        toUpper: (value) => {
            if(value){
                return value.toUpperCase();
            }
            return value;
        },
        upperFirst: (value) => {
            if(value){
                return value.replace(/^\w/, (chr) => {
                    return chr.toUpperCase();
                });
            }
            return value;
        },
        math: (lvalue, operator, rvalue, options) => {
            lvalue = parseFloat(lvalue);
            rvalue = parseFloat(rvalue);

            return {
                '+': lvalue + rvalue,
                '-': lvalue - rvalue,
                '*': lvalue * rvalue,
                '/': lvalue / rvalue,
                '%': lvalue % rvalue
            }[operator];
        },
        showCartButtons: (cart) => {
            if(!cart){
                return 'd-none';
            }
            return '';
        },
        snip: (text) => {
            if(text && text.length > 155){
                return `${text.substring(0, 155)}...`;
            }
            return text;
        },
        contains: (values, value, options) => {
            if(values.includes(value)){
                return options.fn(this);
            }
            return options.inverse(this);
        },
        fixTags: (html) => {
            html = html.replace(/&gt;/g, '>');
            html = html.replace(/&lt;/g, '<');
            return html;
        },
        timeAgo: (date) => {
            return moment(date).fromNow();
        },
        imagePath: (value) => {
            if(value && value.substring(0, 4) === 'http'){
                return value;
            }
            return `${config.baseUrl}${value}`;
        },
        feather: (icon) => {
            // eslint-disable-next-line keyword-spacing
            return `<svg
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="feather feather-${icon}"
                >
                <use xlink:href="/dist/feather-sprite.svg#${icon}"/>
            </svg>`;
        }
    }
});

// session store
const store = new MongoStore({
    uri: getDbUri(config.databaseConnectionString),
    collection: 'sessions'
});

// Setup secrets
if(!config.secretCookie || config.secretCookie === ''){
    const randomString = crypto.randomBytes(20).toString('hex');
    config.secretCookie = randomString;
    updateConfigLocal({ secretCookie: randomString });
}
if(!config.secretSession || config.secretSession === ''){
    const randomString = crypto.randomBytes(20).toString('hex');
    config.secretSession = randomString;
    updateConfigLocal({ secretSession: randomString });
}

app.enable('trust proxy');
app.use(helmet());
app.set('port', process.env.PORT || 1111);
app.use(logger('dev'));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser(config.secretCookie));
app.use(session({
    resave: true,
    saveUninitialized: true,
    secret: config.secretSession,
    cookie: {
        path: '/',
        httpOnly: true,
        maxAge: 900000
    },
    store: store
}));

app.use(express.json({
    // Only on Stripe URL's which need the rawBody
    verify: (req, res, buf) => {
        if(req.originalUrl === '/stripe/subscription_update'){
            req.rawBody = buf.toString();
        }
    }
}));

// Set locales from session
app.use(i18n.init);

// serving static content
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'views', 'themes')));
app.use(express.static(path.join(__dirname, 'node_modules', 'feather-icons')));

// Make stuff accessible to our router
app.use((req, res, next) => {
    req.handlebars = handlebars;
    next();
});

// Ran on all routes
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-store');
    next();
});

// Setup the routes
app.use('/', index);
app.use('/', customer);
app.use('/', product);
app.use('/', order);
app.use('/', user);
app.use('/', admin);
app.use('/', transactions);
app.use('/', reviews);

// Payment route(s)
_.forEach(config.paymentGateway, (gateway) => {
    app.use(`/${gateway}`, require(`./lib/payments/${gateway}`));
});

// catch 404 and forward to error handler
app.use((req, res, next) => {
    const err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if(app.get('env') === 'development'){
    app.use((err, req, res, next) => {
        console.error(colors.red(err.stack));
        if(err && err.code === 'EACCES'){
            res.status(400).json({ message: 'File upload error. Please try again.' });
            return;
        }
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err,
            helpers: handlebars.helpers
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use((err, req, res, next) => {
    console.error(colors.red(err.stack));
    if(err && err.code === 'EACCES'){
        res.status(400).json({ message: 'File upload error. Please try again.' });
        return;
    }
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {},
        helpers: handlebars.helpers
    });
});

// Nodejs version check
const nodeVersionMajor = parseInt(process.version.split('.')[0].replace('v', ''));
if(nodeVersionMajor < 7){
    console.log(colors.red(`Please use Node.js version 7.x or above. Current version: ${nodeVersionMajor}`));
    process.exit(2);
}

app.on('uncaughtException', (err) => {
    console.error(colors.red(err.stack));
    process.exit(2);
});

initDb(config.databaseConnectionString, async (err, db) => {
    // On connection error we display then exit
    if(err){
        console.log(colors.red(`Error connecting to MongoDB: ${err}`));
        process.exit(2);
    }

    // add db to app for routes
    app.db = db;
    app.config = config;
    app.port = app.get('port');

    // Fire up the cron job to clear temp held stock
    cron.schedule('*/1 * * * *', async () => {
        const validSessions = await db.sessions.find({}).toArray();
        const validSessionIds = [];
        _.forEach(validSessions, (value) => {
            validSessionIds.push(value._id);
        });

        // Remove any invalid cart holds
        await db.cart.deleteMany({
            sessionId: { $nin: validSessionIds }
        });
    });

    // Fire up the cron job to create google product feed
    cron.schedule('0 * * * *', async () => {
        await writeGoogleData(db);
    });

    // Create indexes on startup
    if(process.env.NODE_ENV !== 'test'){
        try{
            await runIndexing(app);
        }catch(ex){
            console.error(colors.red(`Error setting up indexes: ${ex.message}`));
        }
    };

    // Start cron job to index
    if(process.env.NODE_ENV !== 'test'){
        cron.schedule('*/30 * * * *', async () => {
            try{
                await runIndexing(app);
            }catch(ex){
                console.error(colors.red(`Error setting up indexes: ${ex.message}`));
            }
        });
    };

    // Set trackStock for testing
    if(process.env.NODE_ENV === 'test'){
        config.trackStock = true;
    };

    // Process schemas
    await addSchemas();

    // Start the app
    try{
        await app.listen(app.get('port'));
        app.emit('appStarted');
        if(process.env.NODE_ENV !== 'test'){
            console.log(colors.green(`expressCart running on host: http://localhost:${app.get('port')}`));
        }
    }catch(ex){
        console.error(colors.red(`Error starting expressCart app:${ex.message}`));
        process.exit(2);
    }
});

module.exports = app;
