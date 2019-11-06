const express = require('express');
const common = require('../lib/common');
const { restrict, checkAccess } = require('../lib/auth');
const escape = require('html-entities').AllHtmlEntities;
const colors = require('colors');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const glob = require('glob');
const mime = require('mime-type/with-db');
const ObjectId = require('mongodb').ObjectID;
const router = express.Router();

// Admin section
router.get('/admin', restrict, (req, res, next) => {
    res.redirect('/admin/orders');
});

// logout
router.get('/admin/logout', (req, res) => {
    req.session.user = null;
    req.session.message = null;
    req.session.messageType = null;
    res.redirect('/');
});

// login form
router.get('/admin/login', async (req, res) => {
    const db = req.app.db;

    const userCount = await db.users.countDocuments({});
    // we check for a user. If one exists, redirect to login form otherwise setup
    if(userCount && userCount > 0){
        // set needsSetup to false as a user exists
        req.session.needsSetup = false;
        res.render('login', {
            title: 'Login',
            referringUrl: req.header('Referer'),
            config: req.app.config,
            message: common.clearSessionValue(req.session, 'message'),
            messageType: common.clearSessionValue(req.session, 'messageType'),
            helpers: req.handlebars.helpers,
            showFooter: 'showFooter'
        });
    }else{
        // if there are no users set the "needsSetup" session
        req.session.needsSetup = true;
        res.redirect('/admin/setup');
    }
});

// login the user and check the password
router.post('/admin/login_action', async (req, res) => {
    const db = req.app.db;

    const user = await db.users.findOne({ userEmail: common.mongoSanitize(req.body.email) });
    if(!user || user === null){
        res.status(400).json({ message: 'A user with that email does not exist.' });
        return;
    }

    // we have a user under that email so we compare the password
    bcrypt.compare(req.body.password, user.userPassword)
    .then((result) => {
        if(result){
            req.session.user = req.body.email;
            req.session.usersName = user.usersName;
            req.session.userId = user._id.toString();
            req.session.isAdmin = user.isAdmin;
            res.status(200).json({ message: 'Login successful' });
            return;
        }
        // password is not correct
        res.status(400).json({ message: 'Access denied. Check password and try again.' });
    });
});

// setup form is shown when there are no users setup in the DB
router.get('/admin/setup', async (req, res) => {
    const db = req.app.db;

    const userCount = await db.users.countDocuments({});
    // dont allow the user to "re-setup" if a user exists.
    // set needsSetup to false as a user exists
    req.session.needsSetup = false;
    if(userCount === 0){
        req.session.needsSetup = true;
        res.render('setup', {
            title: 'Setup',
            config: req.app.config,
            helpers: req.handlebars.helpers,
            message: common.clearSessionValue(req.session, 'message'),
            messageType: common.clearSessionValue(req.session, 'messageType'),
            showFooter: 'showFooter'
        });
        return;
    }
    res.redirect('/admin/login');
});

// insert a user
router.post('/admin/setup_action', async (req, res) => {
    const db = req.app.db;

    const doc = {
        usersName: req.body.usersName,
        userEmail: req.body.userEmail,
        userPassword: bcrypt.hashSync(req.body.userPassword, 10),
        isAdmin: true
    };

    // check for users
    const userCount = await db.users.countDocuments({});
    if(userCount === 0){
        // email is ok to be used.
        try{
            await db.users.insertOne(doc);
            req.session.message = 'User account inserted';
            req.session.messageType = 'success';
            res.redirect('/admin/login');
            return;
        }catch(ex){
            console.error(colors.red('Failed to insert user: ' + ex));
            req.session.message = 'Setup failed';
            req.session.messageType = 'danger';
            res.redirect('/admin/setup');
            return;
        }
    }
    res.redirect('/admin/login');
});

// settings update
router.get('/admin/settings', restrict, (req, res) => {
    res.render('settings', {
        title: 'Cart settings',
        session: req.session,
        admin: true,
        themes: common.getThemes(),
        message: common.clearSessionValue(req.session, 'message'),
        messageType: common.clearSessionValue(req.session, 'messageType'),
        helpers: req.handlebars.helpers,
        config: req.app.config,
        footerHtml: typeof req.app.config.footerHtml !== 'undefined' ? escape.decode(req.app.config.footerHtml) : null,
        googleAnalytics: typeof req.app.config.googleAnalytics !== 'undefined' ? escape.decode(req.app.config.googleAnalytics) : null
    });
});

// settings update
router.post('/admin/createApiKey', restrict, checkAccess, async (req, res) => {
    const db = req.app.db;
    const result = await db.users.findOneAndUpdate({
        _id: ObjectId(req.session.userId),
        isAdmin: true
    }, {
        $set: {
            apiKey: new ObjectId()
        }
    }, {
        returnOriginal: false
    });

    if(result.value && result.value.apiKey){
        res.status(200).json({ message: 'API Key generated', apiKey: result.value.apiKey });
        return;
    }
    res.status(400).json({ message: 'Failed to generate API Key' });
});

// settings update
router.post('/admin/settings/update', restrict, checkAccess, (req, res) => {
    const result = common.updateConfig(req.body);
    if(result === true){
        req.app.config = common.getConfig();
        res.status(200).json({ message: 'Settings successfully updated' });
        return;
    }
    res.status(400).json({ message: 'Permission denied' });
});

// settings update
router.get('/admin/settings/menu', restrict, async (req, res) => {
    const db = req.app.db;
    res.render('settings_menu', {
        title: 'Cart menu',
        session: req.session,
        admin: true,
        message: common.clearSessionValue(req.session, 'message'),
        messageType: common.clearSessionValue(req.session, 'messageType'),
        helpers: req.handlebars.helpers,
        config: req.app.config,
        menu: common.sortMenu(await common.getMenu(db))
    });
});

// settings page list
router.get('/admin/settings/pages', restrict, async (req, res) => {
    const db = req.app.db;
    const pages = await db.pages.find({}).toArray();

    res.render('settings_pages', {
        title: 'Static pages',
        pages: pages,
        session: req.session,
        admin: true,
        message: common.clearSessionValue(req.session, 'message'),
        messageType: common.clearSessionValue(req.session, 'messageType'),
        helpers: req.handlebars.helpers,
        config: req.app.config,
        menu: common.sortMenu(await common.getMenu(db))
    });
});

// settings pages new
router.get('/admin/settings/pages/new', restrict, checkAccess, async (req, res) => {
    const db = req.app.db;

    res.render('settings_page_edit', {
        title: 'Static pages',
        session: req.session,
        admin: true,
        button_text: 'Create',
        message: common.clearSessionValue(req.session, 'message'),
        messageType: common.clearSessionValue(req.session, 'messageType'),
        helpers: req.handlebars.helpers,
        config: req.app.config,
        menu: common.sortMenu(await common.getMenu(db))
    });
});

// settings pages editor
router.get('/admin/settings/pages/edit/:page', restrict, checkAccess, async (req, res) => {
    const db = req.app.db;
    const page = await db.pages.findOne({ _id: common.getId(req.params.page) });
    const menu = common.sortMenu(await common.getMenu(db));
    if(!page){
        res.status(404).render('error', {
            title: '404 Error - Page not found',
            config: req.app.config,
            message: '404 Error - Page not found',
            helpers: req.handlebars.helpers,
            showFooter: 'showFooter',
            menu
        });
        return;
    }

    res.render('settings_page_edit', {
        title: 'Static pages',
        page: page,
        button_text: 'Update',
        session: req.session,
        admin: true,
        message: common.clearSessionValue(req.session, 'message'),
        messageType: common.clearSessionValue(req.session, 'messageType'),
        helpers: req.handlebars.helpers,
        config: req.app.config,
        menu
    });
});

// settings update page
router.post('/admin/settings/pages/update', restrict, checkAccess, async (req, res) => {
    const db = req.app.db;

    const doc = {
        pageName: req.body.pageName,
        pageSlug: req.body.pageSlug,
        pageEnabled: req.body.pageEnabled,
        pageContent: req.body.pageContent
    };

    if(req.body.page_id){
        // existing page
        const page = await db.pages.findOne({ _id: common.getId(req.body.page_id) });
        if(!page){
            res.status(400).json({ message: 'Page not found' });
        }

        try{
            await db.pages.updateOne({ _id: common.getId(req.body.page_id) }, { $set: doc }, {});
            res.status(200).json({ message: 'Page updated successfully', page_id: req.body.page_id });
        }catch(ex){
            res.status(400).json({ message: 'Error updating page. Please try again.' });
        }
    }else{
        // insert page
        try{
            const newDoc = await db.pages.insertOne(doc);
            res.status(200).json({ message: 'New page successfully created', page_id: newDoc._id });
            return;
        }catch(ex){
            res.status(400).json({ message: 'Error creating page. Please try again.' });
        }
    }
});

// settings delete page
router.get('/admin/settings/pages/delete/:page', restrict, checkAccess, async (req, res) => {
    const db = req.app.db;
    try{
        await db.pages.deleteOne({ _id: common.getId(req.params.page) }, {});
        req.session.message = 'Page successfully deleted';
        req.session.messageType = 'success';
        res.redirect('/admin/settings/pages');
        return;
    }catch(ex){
        req.session.message = 'Error deleting page. Please try again.';
        req.session.messageType = 'danger';
        res.redirect('/admin/settings/pages');
    }
});

// new menu item
router.post('/admin/settings/menu/new', restrict, checkAccess, (req, res) => {
    const result = common.newMenu(req, res);
    if(result === false){
        req.session.message = 'Failed creating menu.';
        req.session.messageType = 'danger';
    }
    res.redirect('/admin/settings/menu');
});

// update existing menu item
router.post('/admin/settings/menu/update', restrict, checkAccess, (req, res) => {
    const result = common.updateMenu(req, res);
    if(result === false){
        req.session.message = 'Failed updating menu.';
        req.session.messageType = 'danger';
    }
    res.redirect('/admin/settings/menu');
});

// delete menu item
router.get('/admin/settings/menu/delete/:menuid', restrict, checkAccess, (req, res) => {
    const result = common.deleteMenu(req, res, req.params.menuid);
    if(result === false){
        req.session.message = 'Failed deleting menu.';
        req.session.messageType = 'danger';
    }
    res.redirect('/admin/settings/menu');
});

// We call this via a Ajax call to save the order from the sortable list
router.post('/admin/settings/menu/save_order', restrict, checkAccess, (req, res) => {
    const result = common.orderMenu(req, res);
    if(result === false){
        res.status(400).json({ message: 'Failed saving menu order' });
        return;
    }
    res.status(200);
});

// validate the permalink
router.post('/admin/api/validate_permalink', async (req, res) => {
    // if doc id is provided it checks for permalink in any products other that one provided,
    // else it just checks for any products with that permalink
    const db = req.app.db;

    let query = {};
    if(typeof req.body.docId === 'undefined' || req.body.docId === ''){
        query = { productPermalink: req.body.permalink };
    }else{
        query = { productPermalink: req.body.permalink, _id: { $ne: common.getId(req.body.docId) } };
    }

    const products = await db.products.countDocuments(query);
    if(products && products > 0){
        res.status(400).json({ message: 'Permalink already exists' });
        return;
    }
    res.status(200).json({ message: 'Permalink validated successfully' });
});

// upload the file
const upload = multer({ dest: 'public/uploads/' });
router.post('/admin/file/upload', restrict, checkAccess, upload.single('upload_file'), async (req, res, next) => {
    const db = req.app.db;

    if(req.file){
        const file = req.file;

        // Get the mime type of the file
        const mimeType = mime.lookup(file.originalname);

        // Check for allowed mime type and file size
        if(!common.allowedMimeType.includes(mimeType) || file.size > common.fileSizeLimit){
            // Remove temp file
            fs.unlinkSync(file.path);

            // Redirect to error
            req.session.message = 'File type not allowed or too large. Please try again.';
            req.session.messageType = 'danger';
            res.redirect('/admin/product/edit/' + req.body.productId);
            return;
        }

        // get the product form the DB
        const product = await db.products.findOne({ _id: common.getId(req.body.productId) });
        if(!product){
            // delete the temp file.
            fs.unlinkSync(file.path);

            // Redirect to error
            req.session.message = 'File upload error. Please try again.';
            req.session.messageType = 'danger';
            res.redirect('/admin/product/edit/' + req.body.productId);
            return;
        }

        const productPath = product._id.toString();
        const uploadDir = path.join('public/uploads', productPath);

        // Check directory and create (if needed)
        common.checkDirectorySync(uploadDir);

        const source = fs.createReadStream(file.path);
        const dest = fs.createWriteStream(path.join(uploadDir, file.originalname.replace(/ /g, '_')));

        // save the new file
        source.pipe(dest);
        source.on('end', () => { });

        // delete the temp file.
        fs.unlinkSync(file.path);

        const imagePath = path.join('/uploads', productPath, file.originalname.replace(/ /g, '_'));

        // if there isn't a product featured image, set this one
        if(!product.productImage){
            await db.products.updateOne({ _id: common.getId(req.body.productId) }, { $set: { productImage: imagePath } }, { multi: false });
            req.session.message = 'File uploaded successfully';
            req.session.messageType = 'success';
            res.redirect('/admin/product/edit/' + req.body.productId);
            return;
        }
        req.session.message = 'File uploaded successfully';
        req.session.messageType = 'success';
        res.redirect('/admin/product/edit/' + req.body.productId);
        return;
    }
    // Redirect to error
    req.session.message = 'File upload error. Please select a file.';
    req.session.messageType = 'danger';
    res.redirect('/admin/product/edit/' + req.body.productId);
});

// delete a file via ajax request
router.post('/admin/testEmail', restrict, (req, res) => {
    const config = req.app.config;
    // TODO: Should fix this to properly handle result
    common.sendEmail(config.emailAddress, 'expressCart test email', 'Your email settings are working');
    res.status(200).json({ message: 'Test email sent' });
});

// delete a file via ajax request
router.post('/admin/file/delete', restrict, checkAccess, async (req, res) => {
    req.session.message = null;
    req.session.messageType = null;

    try{
        await fs.unlinkSync('public/' + req.body.img);
        res.writeHead(200, { 'Content-Type': 'application/text' });
        res.end('File deleted successfully');
    }catch(ex){
        console.error(colors.red('File delete error: ' + ex));
        res.writeHead(400, { 'Content-Type': 'application/text' });
        res.end('Failed to delete file: ' + ex);
    }
});

router.get('/admin/files', restrict, async (req, res) => {
    // loop files in /public/uploads/
    const files = await glob.sync('public/uploads/**', { nosort: true });

    // sort array
    files.sort();

    // declare the array of objects
    const fileList = [];
    const dirList = [];

    // loop these files
    for(let i = 0; i < files.length; i++){
        // only want files
        if(fs.lstatSync(files[i]).isDirectory() === false){
            // declare the file object and set its values
            const file = {
                id: i,
                path: files[i].substring(6)
            };

            // push the file object into the array
            fileList.push(file);
        }else{
            const dir = {
                id: i,
                path: files[i].substring(6)
            };

            // push the dir object into the array
            dirList.push(dir);
        }
    }

    // render the files route
    res.render('files', {
        title: 'Files',
        files: fileList,
        admin: true,
        dirs: dirList,
        session: req.session,
        config: common.get(),
        message: common.clearSessionValue(req.session, 'message'),
        messageType: common.clearSessionValue(req.session, 'messageType')
    });
});

module.exports = router;
