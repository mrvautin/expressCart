const uglifycss = require('uglifycss');
const escape = require('html-entities').AllHtmlEntities;
const fs = require('fs');
const path = require('path');
const _ = require('lodash');

const getConfig = () => {
    let config = JSON.parse(fs.readFileSync(path.join(__dirname, '../config', 'settings.json'), 'utf8'));
    const localConfigFilePath = path.join(__dirname, '../config', 'settings-local.json');

    // Check for local config file and merge with base settings
    if(fs.existsSync(localConfigFilePath)){
        const localConfigFile = JSON.parse(fs.readFileSync(localConfigFilePath, 'utf8'));
        config = Object.assign(config, localConfigFile);
    }

    // Override from env.yaml environment file
    Object.keys(config).forEach((configKey) => {
        if(process.env[configKey]){
            config[configKey] = process.env[configKey];
        }
    });

    config.customCss = typeof config.customCss !== 'undefined' ? escape.decode(config.customCss) : null;
    config.footerHtml = typeof config.footerHtml !== 'undefined' ? escape.decode(config.footerHtml) : null;
    config.googleAnalytics = typeof config.googleAnalytics !== 'undefined' ? escape.decode(config.googleAnalytics) : null;

    // setup theme
    config.themeViews = '';
    if(typeof config.theme === 'undefined' || config.theme === ''){
        config.theme = 'Cloth'; // Default to Cloth theme
    }

    config.themeViews = `../views/themes/${config.theme}/`;

    // set the environment for files
    config.env = '.min';
    if(process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined){
        config.env = '';
    }

    // load modules
    try{
        config.modules.loaded = {};
        Object.keys(config.modules.enabled).forEach((mod) => {
            config.modules.loaded[mod] = require(`./modules/${config.modules.enabled[mod]}`);
        });
    }catch(ex){
        console.log('Could not load modules, check your config.', ex);
        process.exit(1);
    }

    return config;
};

const getPaymentConfig = (gateway) => {
    const siteConfig = getConfig();

    // Read the Gateway config
    const config = {};
    _.forEach(siteConfig.paymentGateway, (gateway) => {
        const gateConfigFile = path.join(__dirname, '../config', 'payment', 'config', `${gateway}.json`);
        if(fs.existsSync(gateConfigFile)){
            config[gateway] = JSON.parse(fs.readFileSync(gateConfigFile, 'utf8'));
        }

        // Override from env.yaml environment file
        Object.keys(config[gateway]).forEach((configKey) => {
            if(process.env[gateway] && process.env[gateway][configKey]){
                config[gateway][configKey] = process.env[gateway][configKey];
            }
        });
    });

    // If Gateway supplied, return that Gateway config
    if(gateway && config[gateway]){
        return config[gateway];
    }

    return config;
};

const updateConfig = (fields) => {
    const settingsFile = getConfig();

    _.forEach(fields, (value, key) => {
        settingsFile[key] = value;
        if(key === 'customCss_input'){
            settingsFile.customCss = escape.encode(uglifycss.processString(value));
        }
        if(key === 'footerHtml_input'){
            const footerHtml = typeof value !== 'undefined' || value === '' ? escape.encode(value) : '';
            settingsFile.footerHtml = footerHtml;
        }
        if(key === 'googleAnalytics_input'){
            const googleAnalytics = typeof value !== 'undefined' ? escape.encode(value) : '';
            settingsFile.googleAnalytics = googleAnalytics;
        }
    });

    // delete any settings
    delete settingsFile.customCss_input;
    delete settingsFile.footerHtml_input;
    delete settingsFile.googleAnalytics_input;

    if(fields.emailSecure === 'on'){
        settingsFile.emailSecure = true;
    }else{
        settingsFile.emailSecure = false;
    }

    if(fields.emailPort){
        settingsFile.emailPort = parseInt(fields.emailPort);
    }

    if(fields.productsPerRow){
        settingsFile.productsPerRow = parseInt(fields.productsPerRow);
    }

    if(fields.productsPerPage){
        settingsFile.productsPerPage = parseInt(fields.productsPerPage);
    }

    // If we have a local settings file (not git tracked) we loop its settings and save
    // and changes made to them. All other settings get updated to the base settings file.
    const localSettingsFile = path.join(__dirname, '../config', 'settings-local.json');
    if(fs.existsSync(localSettingsFile)){
        const localSettings = JSON.parse(fs.readFileSync(localSettingsFile));
        _.forEach(localSettings, (value, key) => {
            if(fields[key]){
                localSettings[key] = fields[key];

                // Exists in local so remove from main settings file
                delete settingsFile[key];
            }
        });
        // Save our local settings
        try{
            fs.writeFileSync(localSettingsFile, JSON.stringify(localSettings, null, 4));
        }catch(exception){
            console.log('Failed to save local settings file', exception);
        }
    }

    // write base settings file
    const baseSettingsFile = path.join(__dirname, '../config', 'settings.json');
    try{
        fs.writeFileSync(baseSettingsFile, JSON.stringify(settingsFile, null, 4));
        return true;
    }catch(exception){
        return false;
    }
};

const updateConfigLocal = (field) => {
    const localSettingsFile = path.join(__dirname, '../config', 'settings-local.json');
    try{
        let localSettings = {};
        if(fs.existsSync(localSettingsFile)){
            localSettings = JSON.parse(fs.readFileSync(localSettingsFile));
        }
        Object.assign(localSettings, field);
        fs.writeFileSync(localSettingsFile, JSON.stringify(localSettings, null, 4));
    }catch(exception){
        console.log('Failed to save local settings file', exception);
    }
};

module.exports = {
    getConfig,
    getPaymentConfig,
    updateConfig,
    updateConfigLocal
};
