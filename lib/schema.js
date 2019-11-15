const path = require('path');
const fs = require('fs');
const glob = require('glob');
const Ajv = require('ajv');
const ajv = new Ajv();

const addSchemas = () => {
    const schemaFiles = glob.sync('./lib/**/*.json');
    schemaFiles.forEach((file) => {
        const fileData = JSON.parse(fs.readFileSync(file, 'utf-8'));
        ajv.addSchema(fileData, path.basename(file, '.json'));
    });
};

const validateJson = (schema, json) => {
    return ajv.validate(schema, json);
};

module.exports = {
    addSchemas,
    validateJson
};
