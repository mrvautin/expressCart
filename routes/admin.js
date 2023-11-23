const express = require('express');
const { restrict, checkAccess } = require('../lib/auth');
const escape = require('html-entities').AllHtmlEntities;
const colors = require('colors');
const bcrypt = require('bcryptjs');
const moment = require('moment');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const mime = require('mime-type/with-db');
const csrf = require('csurf');
const util = require('util');
const stream = require('stream');
const { validateJson } = require('../lib/schema');

const {adminDashboard,logout,login, loginValidate, adminSetup, setupUser, dashboard, getSettings, genAPI, settingsUpdate, settingsMenu, getPages, newPages, editPage, insertPage, deletePage, menuItem, saveOrder, validatePerma, discount, editDiscount, updateDiscount, getDiscount, createDiscount, deleteDiscount, addImage, uploadFile, testEmail, searchAll} = require('../controller/admin.controller')
const {
    clearSessionValue,
    mongoSanitize,
    getThemes,
    getId,
    allowedMimeType,
    fileSizeLimit,
    checkDirectorySync,
    sendEmail
} = require('../lib/common');
const {
    getConfig,
    updateConfig
} = require('../lib/config');
const {
    sortMenu,
    getMenu,
    newMenu,
    updateMenu,
    deleteMenu,
    orderMenu
} = require('../lib/menu');
const ObjectId = require('mongodb').ObjectID;
const router = express.Router();
const csrfProtection = csrf({ cookie: true });

// Regex
const emailRegex = /\S+@\S+\.\S+/;
const numericRegex = /^\d*\.?\d*$/;

// Admin section
router.get('/admin',adminDashboard);

// logout
router.get('/admin/logout',logout);

// Used for tests only
if(process.env.NODE_ENV === 'test'){
    router.get('/admin/csrf', csrfProtection, (req, res, next) => {
        res.json({
            csrf: req.csrfToken()
        });
    });
}

// login form
router.get('/admin/login', login );

// login the user and check the password
router.post('/admin/login_action', loginValidate);

// setup form is shown when there are no users setup in the DB
router.get('/admin/setup', adminSetup);

// insert a user
router.post('/admin/setup_action', setupUser);

// dashboard
router.get('/admin/dashboard', csrfProtection, restrict, dashboard);

// settings
router.get('/admin/settings', csrfProtection, restrict, getSettings);

// create API key
router.post('/admin/createApiKey', restrict, checkAccess, genAPI);

// settings update
router.post('/admin/settings/update', restrict, checkAccess, settingsUpdate);

// settings menu
router.get('/admin/settings/menu', csrfProtection, restrict, settingsMenu);

// page list
router.get('/admin/settings/pages', csrfProtection, restrict, getPages);

// pages new
router.get('/admin/settings/pages/new', csrfProtection, restrict, checkAccess, newPages);

// pages editor
router.get('/admin/settings/pages/edit/:page', csrfProtection, restrict, checkAccess, editPage);

// insert/update page
router.post('/admin/settings/page', restrict, checkAccess, insertPage);

// delete a page
router.post('/admin/settings/page/delete', restrict, checkAccess, deletePage);

// new menu item
router.post('/admin/settings/menu/new', restrict, checkAccess, menuItem);

// update existing menu item
router.post('/admin/settings/menu/update', restrict, checkAccess, updateMenu);

// delete menu item
router.post('/admin/settings/menu/delete', restrict, checkAccess, deleteMenu);

// We call this via a Ajax call to save the order from the sortable list 
router.post('/admin/settings/menu/saveOrder', restrict, checkAccess, saveOrder);

// validate the permalink
router.post('/admin/validatePermalink', validatePerma);

// Discount codes
router.get('/admin/settings/discounts', csrfProtection, restrict, checkAccess, discount);

// Edit a discount code
router.get('/admin/settings/discount/edit/:id', csrfProtection, restrict, checkAccess, editDiscount);

// Update discount code
router.post('/admin/settings/discount/update', restrict, checkAccess, updateDiscount);

// Create a discount code
router.get('/admin/settings/discount/new', csrfProtection, restrict, checkAccess, getDiscount);

// Create a discount code
router.post('/admin/settings/discount/create', csrfProtection, restrict, checkAccess, createDiscount);

// Delete discount code
router.delete('/admin/settings/discount/delete', restrict, checkAccess, deleteDiscount);

// Add image by URL
router.post('/admin/file/url', restrict, checkAccess, addImage);

// upload the file
const upload = multer({ dest: 'public/uploads/' });
router.post('/admin/file/upload', restrict, checkAccess, upload.single('uploadFile'), uploadFile);

// delete a file via ajax request
router.post('/admin/testEmail', restrict, testEmail);

router.post('/admin/searchall', restrict, searchAll);

module.exports = router;