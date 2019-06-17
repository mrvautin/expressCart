const express = require('express');
const path = require('path');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const session = require('express-session');
const moment = require('moment');
const _ = require('lodash');
const MongoStore = require('connect-mongodb-session')(session);
const numeral = require('numeral');
const helmet = require('helmet');
const colors = require('colors');
const cron = require('node-cron');
const common = require('./lib/common');
const { runIndexing } = require('./lib/indexing');
const { addSchemas } = require('./lib/schema');
const { initDb } = require('./lib/db');
let handlebars = require('express-handlebars');

// Validate our settings schema
const Ajv = require('ajv');
const ajv = new Ajv({ useDefaults: true });

// get config
let config = common.getConfig();

const baseConfig = ajv.validate(require('./config/baseSchema'), config);
if(baseConfig === false){
    console.log(colors.red(`settings.json incorrect: ${ajv.errorsText()}`));
    process.exit(2);
}

// Validate the payment gateway config
if(config.paymentGateway === 'paypal'){
    const paypalConfig = ajv.validate(require('./config/paypalSchema'), require('./config/paypal.json'));
    if(paypalConfig === false){
        console.log(colors.red(`PayPal config is incorrect: ${ajv.errorsText()}`));
        process.exit(2);
    }
}
if(config.paymentGateway === 'stripe'){
    const stripeConfig = ajv.validate(require('./config/stripeSchema'), require('./config/stripe.json'));
    if(stripeConfig === false){
        console.log(colors.red(`Stripe config is incorrect: ${ajv.errorsText()}`));
        process.exit(2);
    }
}
if(config.paymentGateway === 'authorizenet'){
    const authorizenetConfig = ajv.validate(require('./config/authorizenetSchema'), require('./config/authorizenet.json'));
    if(authorizenetConfig === false){
        console.log(colors.red(`Authorizenet config is incorrect: ${ajv.errorsText()}`));
        process.exit(2);
    }
}

// require the routes
const index = require('./routes/index');
const admin = require('./routes/admin');
const product = require('./routes/product');
const customer = require('./routes/customer');
const order = require('./routes/order');
const user = require('./routes/user');
const paypal = require('./routes/payments/paypal');
const stripe = require('./routes/payments/stripe');
const authorizenet = require('./routes/payments/authorizenet');

const app = express();

// view engine setup
app.set('views', path.join(__dirname, '/views'));
app.engine('hbs', handlebars({
    extname: 'hbs',
    layoutsDir: path.join(__dirname, 'views', 'layouts'),
    defaultLayout: 'layout.hbs',
    partialsDir: [ path.join(__dirname, 'views') ]
}));
app.set('view engine', 'hbs');

// helpers for the handlebar templating platform
handlebars = handlebars.create({
    helpers: {
        perRowClass: (numProducts) => {
            if(parseInt(numProducts) === 1){
                return'col-md-12 col-xl-12 col m12 xl12 product-item';
            }
            if(parseInt(numProducts) === 2){
                return'col-md-6 col-xl-6 col m6 xl6 product-item';
            }
            if(parseInt(numProducts) === 3){
                return'col-md-4 col-xl-4 col m4 xl4 product-item';
            }
            if(parseInt(numProducts) === 4){
                return'col-md-3 col-xl-3 col m3 xl3 product-item';
            }

            return'col-md-6 col-xl-6 col m6 xl6 product-item';
        },
        menuMatch: (title, search) => {
            if(!title || !search){
                return'';
            }
            if(title.toLowerCase().startsWith(search.toLowerCase())){
                return'class="navActive"';
            }
            return'';
        },
        getTheme: (view) => {
            return`themes/${config.theme}/${view}`;
        },
        formatAmount: (amt) => {
            if(amt){
                return numeral(amt).format('0.00');
            }
            return'0.00';
        },
        amountNoDecimal: (amt) => {
            if(amt){
                return handlebars.helpers.formatAmount(amt).replace('.', '');
            }
            return handlebars.helpers.formatAmount(amt);
        },
        getStatusColor: (status) => {
            switch(status){
            case'Paid':
                return'success';
            case'Approved':
                return'success';
            case'Approved - Processing':
                return'success';
            case'Failed':
                return'danger';
            case'Completed':
                return'success';
            case'Shipped':
                return'success';
            case'Pending':
                return'warning';
            default:
                return'danger';
            }
        },
        checkProductOptions: (opts) => {
            if(opts){
                return'true';
            }
            return'false';
        },
        currencySymbol: (value) => {
            if(typeof value === 'undefined' || value === ''){
                return'$';
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
            return'';
        },
        checkedState: (state) => {
            if(state === 'true' || state === true){
                return'checked';
            }
            return'';
        },
        selectState: (state, value) => {
            if(state === value){
                return'selected';
            }
            return'';
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
        ifCond: (v1, operator, v2, options) => {
            switch(operator){
            case'==':
                return(v1 === v2) ? options.fn(this) : options.inverse(this);
            case'!=':
                return(v1 !== v2) ? options.fn(this) : options.inverse(this);
            case'===':
                return(v1 === v2) ? options.fn(this) : options.inverse(this);
            case'<':
                return(v1 < v2) ? options.fn(this) : options.inverse(this);
            case'<=':
                return(v1 <= v2) ? options.fn(this) : options.inverse(this);
            case'>':
                return(v1 > v2) ? options.fn(this) : options.inverse(this);
            case'>=':
                return(v1 >= v2) ? options.fn(this) : options.inverse(this);
            case'&&':
                return(v1 && v2) ? options.fn(this) : options.inverse(this);
            case'||':
                return(v1 || v2) ? options.fn(this) : options.inverse(this);
            default:
                return options.inverse(this);
            }
        },
        isAnAdmin: (value, options) => {
            if(value === 'true' || value === true){
                return options.fn(this);
            }
            return options.inverse(this);
        }
    }
});

// session store
let store = new MongoStore({
    uri: config.databaseConnectionString,
    collection: 'sessions'
});

app.enable('trust proxy');
app.use(helmet());
app.set('port', process.env.PORT || 1111);
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser('5TOCyfH3HuszKGzFZntk'));
app.use(session({
    resave: true,
    saveUninitialized: true,
    secret: 'pAgGxo8Hzg7PFlv1HpO8Eg0Y6xtP7zYx',
    cookie: {
        path: '/',
        httpOnly: true,
        maxAge: 900000
    },
    store: store
}));

// serving static content
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'views', 'themes')));

// Make stuff accessible to our router
app.use((req, res, next) => {
    req.handlebars = handlebars;
    next();
});

// update config when modified
app.use((req, res, next) => {
    if(res.configDirty){
        config = common.getConfig();
        app.config = config;
    }
    next();
});

// Ran on all routes
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-store');
    next();
});

// setup the routes
app.use('/', index);
app.use('/', customer);
app.use('/', product);
app.use('/', order);
app.use('/', user);
app.use('/', admin);
app.use('/paypal', paypal);
app.use('/stripe', stripe);
app.use('/authorizenet', authorizenet);

// catch 404 and forward to error handler
app.use((req, res, next) => {
    let err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if(app.get('env') === 'development'){
    app.use((err, req, res, next) => {
        console.error(colors.red(err.stack));
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
        console.log(colors.red('Error connecting to MongoDB: ' + err));
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
        await db.cart.remove({
            sessionId: { $nin: validSessionIds }
        });
    });

    // Set trackStock for testing
    if(process.env.NODE_ENV === 'test'){
        config.trackStock = true;
    }

    // Process schemas
    await addSchemas();

    // We index when not in test env
    if(process.env.NODE_ENV !== 'test'){
        try{
            await runIndexing(app);
        }catch(ex){
            console.error(colors.red('Error setting up indexes:' + err));
        }
    }

    // Start the app
    try{
        await app.listen(app.get('port'));
        app.emit('appStarted');
        console.log(colors.green('expressCart running on host: http://localhost:' + app.get('port')));
    }catch(ex){
        console.error(colors.red('Error starting expressCart app:' + err));
        process.exit(2);
    }
});

module.exports = app;
