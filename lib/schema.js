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

    // Email format
    const emailRegex = /^([\w-.]+)@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.)|(([\w-]+\.)+))([a-zA-Z]{2,4}|[0-9]{1,3})(\]?)$/;
    ajv.addFormat('emailAddress', emailRegex);

    // Amount format
    const amountRegex = /^[1-9]\d*(\.\d+)?$/;
    ajv.addFormat('amount', amountRegex);

    ajv.addKeyword('isNotEmpty', {
        type: 'string',
        validate: (schema, data) => {
          return typeof data === 'string' && data.trim() !== '';
        },
        errors: false
    });
};

const validateJson = (schema, json) => {
    const result = ajv.validate(schema, json);
    return{
        result,
        errors: ajv.errors
    };
};

module.exports = {
    addSchemas,
    validateJson
};
