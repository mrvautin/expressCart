const path = require('path');
const fs = require('fs');
const _ = require('lodash');
const Validator = require('jsonschema').Validator;
const v = new Validator();
const glob = require('glob-fs')();

const addSchemas = () => {
    const schemaFiles = glob.readdirSync('./lib/**/*.json');
    _.forEach(schemaFiles, (file) => {
        const fileData = JSON.parse(fs.readFileSync(file, 'utf-8'));
        v.addSchema(fileData, path.basename(schemaFiles[0], '.json'));
    });
};

const validateJson = (schema, json) => {
    return v.validate(json, schema);
};

module.exports = {
    addSchemas,
    validateJson
};
