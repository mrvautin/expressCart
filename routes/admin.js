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
router.get('/admin/login', (req, res) => {
    let db = req.app.db;

    db.users.count({}, (err, userCount) => {
        if(err){
            // if there are no users set the "needsSetup" session
            req.session.needsSetup = true;
            res.redirect('/admin/setup');
        }
        // we check for a user. If one exists, redirect to login form otherwise setup
        if(userCount > 0){
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
});

// login the user and check the password
router.post('/admin/login_action', (req, res) => {
    let db = req.app.db;

    db.users.findOne({ userEmail: common.mongoSanitize(req.body.email) }, (err, user) => {
        if(err){
            res.status(400).json({ message: 'A user with that email does not exist.' });
            return;
        }

        // check if user exists with that email
        if(user === undefined || user === null){
            res.status(400).json({ message: 'A user with that email does not exist.' });
        }else{
            // we have a user under that email so we compare the password
            bcrypt.compare(req.body.password, user.userPassword)
            .then((result) => {
                if(result){
                    req.session.user = req.body.email;
                    req.session.usersName = user.usersName;
                    req.session.userId = user._id.toString();
                    req.session.isAdmin = user.isAdmin;
                    res.status(200).json({ message: 'Login successful' });
                }else{
                    // password is not correct
                    res.status(400).json({ message: 'Access denied. Check password and try again.' });
                }
            });
        }
    });
});

// setup form is shown when there are no users setup in the DB
router.get('/admin/setup', (req, res) => {
    let db = req.app.db;

    db.users.count({}, (err, userCount) => {
        if(err){
            console.error(colors.red('Error getting users for setup', err));
        }
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
        }else{
            res.redirect('/admin/login');
        }
    });
});

// insert a user
router.post('/admin/setup_action', (req, res) => {
    const db = req.app.db;

    let doc = {
        usersName: req.body.usersName,
        userEmail: req.body.userEmail,
        userPassword: bcrypt.hashSync(req.body.userPassword, 10),
        isAdmin: true
    };

    // check for users
    db.users.count({}, (err, userCount) => {
        if(err){
            console.info(err.stack);
        }
        if(userCount === 0){
            // email is ok to be used.
            db.users.insert(doc, (err, doc) => {
                // show the view
                if(err){
                    console.error(colors.red('Failed to insert user: ' + err));
                    req.session.message = 'Setup failed';
                    req.session.messageType = 'danger';
                    res.redirect('/admin/setup');
                }else{
                    req.session.message = 'User account inserted';
                    req.session.messageType = 'success';
                    res.redirect('/admin/login');
                }
            });
        }else{
            res.redirect('/admin/login');
        }
    });
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
    let result = await db.users.findOneAndUpdate({
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
        res.status(200).json({ message: 'Settings successfully updated' });
        res.configDirty = true;
        return;
    }
    res.status(400).json({ message: 'Permission denied' });
});

// settings update
router.post('/admin/settings/option/remove', restrict, checkAccess, (req, res) => {
    const db = req.app.db;
    db.products.findOne({ _id: common.getId(req.body.productId) }, (err, product) => {
        if(err){
            console.info(err.stack);
        }
        if(product && product.productOptions){
            let optJson = JSON.parse(product.productOptions);
            delete optJson[req.body.optName];

            db.products.update({ _id: common.getId(req.body.productId) }, { $set: { productOptions: JSON.stringify(optJson) } }, (err, numReplaced) => {
                if(err){
                    console.info(err.stack);
                }
                if(numReplaced.result.nModified === 1){
                    res.status(200).json({ message: 'Option successfully removed' });
                }else{
                    res.status(400).json({ message: 'Failed to remove option. Please try again.' });
                }
            });
        }else{
            res.status(400).json({ message: 'Product not found. Try saving before removing.' });
        }
    });
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
router.get('/admin/settings/pages', restrict, (req, res) => {
    const db = req.app.db;
    db.pages.find({}).toArray(async (err, pages) => {
        if(err){
            console.info(err.stack);
        }

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
router.get('/admin/settings/pages/edit/:page', restrict, checkAccess, (req, res) => {
    const db = req.app.db;
    db.pages.findOne({ _id: common.getId(req.params.page) }, async (err, page) => {
        if(err){
            console.info(err.stack);
        }
        // page found
        const menu = common.sortMenu(await common.getMenu(db));
        if(page){
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
        }else{
            // 404 it!
            res.status(404).render('error', {
                title: '404 Error - Page not found',
                config: req.app.config,
                message: '404 Error - Page not found',
                helpers: req.handlebars.helpers,
                showFooter: 'showFooter',
                menu
            });
        }
    });
});

// settings update page
router.post('/admin/settings/pages/update', restrict, checkAccess, (req, res) => {
    const db = req.app.db;

    let doc = {
        pageName: req.body.pageName,
        pageSlug: req.body.pageSlug,
        pageEnabled: req.body.pageEnabled,
        pageContent: req.body.pageContent
    };

    if(req.body.page_id){
        // existing page
        db.pages.findOne({ _id: common.getId(req.body.page_id) }, (err, page) => {
            if(err){
                console.info(err.stack);
            }
            if(page){
                db.pages.update({ _id: common.getId(req.body.page_id) }, { $set: doc }, {}, (err, numReplaced) => {
                    if(err){
                        console.info(err.stack);
                    }
                    res.status(200).json({ message: 'Page updated successfully', page_id: req.body.page_id });
                });
            }else{
                res.status(400).json({ message: 'Page not found' });
            }
        });
    }else{
        // insert page
        db.pages.insert(doc, (err, newDoc) => {
            if(err){
                res.status(400).json({ message: 'Error creating page. Please try again.' });
            }else{
                res.status(200).json({ message: 'New page successfully created', page_id: newDoc._id });
            }
        });
    }
});

// settings delete page
router.get('/admin/settings/pages/delete/:page', restrict, checkAccess, (req, res) => {
    const db = req.app.db;
    db.pages.remove({ _id: common.getId(req.params.page) }, {}, (err, numRemoved) => {
        if(err){
            req.session.message = 'Error deleting page. Please try again.';
            req.session.messageType = 'danger';
            res.redirect('/admin/settings/pages');
            return;
        }
        req.session.message = 'Page successfully deleted';
        req.session.messageType = 'success';
        res.redirect('/admin/settings/pages');
    });
});

// new menu item
router.post('/admin/settings/menu/new', restrict, checkAccess, (req, res) => {
    let result = common.newMenu(req, res);
    if(result === false){
        req.session.message = 'Failed creating menu.';
        req.session.messageType = 'danger';
    }
    res.redirect('/admin/settings/menu');
});

// update existing menu item
router.post('/admin/settings/menu/update', restrict, checkAccess, (req, res) => {
    let result = common.updateMenu(req, res);
    if(result === false){
        req.session.message = 'Failed updating menu.';
        req.session.messageType = 'danger';
    }
    res.redirect('/admin/settings/menu');
});

// delete menu item
router.get('/admin/settings/menu/delete/:menuid', restrict, checkAccess, (req, res) => {
    let result = common.deleteMenu(req, res, req.params.menuid);
    if(result === false){
        req.session.message = 'Failed deleting menu.';
        req.session.messageType = 'danger';
    }
    res.redirect('/admin/settings/menu');
});

// We call this via a Ajax call to save the order from the sortable list
router.post('/admin/settings/menu/save_order', restrict, checkAccess, (req, res) => {
    let result = common.orderMenu(req, res);
    if(result === false){
        res.status(400).json({ message: 'Failed saving menu order' });
        return;
    }
    res.status(200);
});

// validate the permalink
router.post('/admin/api/validate_permalink', (req, res) => {
    // if doc id is provided it checks for permalink in any products other that one provided,
    // else it just checks for any products with that permalink
    const db = req.app.db;

    let query = {};
    if(typeof req.body.docId === 'undefined' || req.body.docId === ''){
        query = { productPermalink: req.body.permalink };
    }else{
        query = { productPermalink: req.body.permalink, _id: { $ne: common.getId(req.body.docId) } };
    }

    db.products.count(query, (err, products) => {
        if(err){
            console.info(err.stack);
        }
        if(products > 0){
            res.status(400).json({ message: 'Permalink already exists' });
        }else{
            res.status(200).json({ message: 'Permalink validated successfully' });
        }
    });
});

// upload the file
let upload = multer({ dest: 'public/uploads/' });
router.post('/admin/file/upload', restrict, checkAccess, upload.single('upload_file'), (req, res, next) => {
    const db = req.app.db;

    if(req.file){
        let file = req.file;

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
        db.products.findOne({ _id: common.getId(req.body.productId) }, (err, product) => {
            if(err){
                console.info(err.stack);
                // delete the temp file.
                fs.unlinkSync(file.path);

                // Redirect to error
                req.session.message = 'File upload error. Please try again.';
                req.session.messageType = 'danger';
                res.redirect('/admin/product/edit/' + req.body.productId);
                return;
            }

            const productPath = product.productPermalink;
            let uploadDir = path.join('public/uploads', productPath);

            // Check directory and create (if needed)
            common.checkDirectorySync(uploadDir);

            let source = fs.createReadStream(file.path);
            let dest = fs.createWriteStream(path.join(uploadDir, file.originalname.replace(/ /g, '_')));

            // save the new file
            source.pipe(dest);
            source.on('end', () => { });

            // delete the temp file.
            fs.unlinkSync(file.path);

            let imagePath = path.join('/uploads', productPath, file.originalname.replace(/ /g, '_'));

            // if there isn't a product featured image, set this one
            if(!product.productImage){
                db.products.update({ _id: common.getId(req.body.productId) }, { $set: { productImage: imagePath } }, { multi: false }, (err, numReplaced) => {
                    if(err){
                        console.info(err.stack);
                    }
                    req.session.message = 'File uploaded successfully';
                    req.session.messageType = 'success';
                    res.redirect('/admin/product/edit/' + req.body.productId);
                });
            }else{
                req.session.message = 'File uploaded successfully';
                req.session.messageType = 'success';
                res.redirect('/admin/product/edit/' + req.body.productId);
            }
        });
    }else{
        // Redirect to error
        req.session.message = 'File upload error. Please select a file.';
        req.session.messageType = 'danger';
        res.redirect('/admin/product/edit/' + req.body.productId);
    }
});

// delete a file via ajax request
router.post('/admin/testEmail', restrict, (req, res) => {
    let config = req.app.config;
    // TODO: Should fix this to properly handle result
    common.sendEmail(config.emailAddress, 'expressCart test email', 'Your email settings are working');
    res.status(200).json({ message: 'Test email sent' });
});

// delete a file via ajax request
router.post('/admin/file/delete', restrict, checkAccess, (req, res) => {
    req.session.message = null;
    req.session.messageType = null;

    fs.unlink('public/' + req.body.img, (err) => {
        if(err){
            console.error(colors.red('File delete error: ' + err));
            res.writeHead(400, { 'Content-Type': 'application/text' });
            res.end('Failed to delete file: ' + err);
        }else{
            res.writeHead(200, { 'Content-Type': 'application/text' });
            res.end('File deleted successfully');
        }
    });
});

router.get('/admin/files', restrict, (req, res) => {
    // loop files in /public/uploads/
    glob('public/uploads/**', { nosort: true }, (er, files) => {
        // sort array
        files.sort();

        // declare the array of objects
        let fileList = [];
        let dirList = [];

        // loop these files
        for(let i = 0; i < files.length; i++){
            // only want files
            if(fs.lstatSync(files[i]).isDirectory() === false){
                // declare the file object and set its values
                let file = {
                    id: i,
                    path: files[i].substring(6)
                };

                // push the file object into the array
                fileList.push(file);
            }else{
                let dir = {
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
});

module.exports = router;
