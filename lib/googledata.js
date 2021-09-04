const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const convert = require('xml-js');
const {
    getConfig
} = require('./config');

const writeGoogleData = async (db) => {
    const config = getConfig();
    const feedName = "googleproducts";
    const fileName = path.join('bin', `${feedName}.xml`);
    let localized;
    // Remove old file
    try{
        fs.unlinkSync(fileName);
    }catch(ex){}

    // Get products
    const products = await db.products.find({ productPublished: true }).toArray();

    // Setup the XML
    const xmlOpt = { compact: true, ignoreComment: true, spaces: 4 };
    const jsonObj = {
        _declaration: { _attributes: { version: '1.0', encoding: 'utf-8' } },
        rss: {
            _attributes: {
                'xmlns:g': 'http://base.google.com/ns/1.0',
                version: '2.0'
            },
            channel: {
                title: config.cartTitle,
                description: config.cartDescription,
                link: config.baseUrl,
                item: []
            }
        }
    };

    // Add products
    _.forEach(products, async (product) => {
        const item = {
            'g:title': product.productTitle,
            'g:id': product._id.toString(),
            'g:link': `${config.baseUrl}/product/${product.productPermalink}`,
            'g:description': product.productDescription,
            'g:price': `${product.productPrice} ${config.currencyISO}`,
            'g:image_link': `${config.baseUrl}/uploads/placeholder.png`,
            'g:availability': 'in stock'
        };
        const extraLanguages = config.availableLanguages.filter(x => x !== config.defaultLocale);
        //make localized feed per language
        localized = extraLanguages.reduce((acc,language) => {
            acc[language] = acc[language] ?  acc[language] : [];
            acc[language].push({
                'g:title': product[`productTitle_${language}`],
                'g:id': product._id.toString(),
                'g:link': `${config.baseUrl}/product/${product.productPermalink}`,
                'g:description': product[`productTitle_${language}`],
                'g:price': `${product.productPrice} ${config.currencyISO}`,
                'g:image_link': `${config.baseUrl}/uploads/placeholder.png`,
                'g:availability': 'in stock'
            });
            return acc;
        }, {} )

        // Override image if exists
        if(product.productImage){
            item['g:image_link'] = `${config.baseUrl}/${product.productImage}`;
        }

        // Override Gtin if exists
        if(product.productGtin){
            item['g:gtin'] = product.productGtin;
        }

        jsonObj.rss.channel.item.push(item);
    });

    // Generate XML
    const xml = convert.js2xml(jsonObj, xmlOpt);


    // Write product file
    fs.writeFileSync(fileName, xml);

    for(const language in localized){
        jsonObj.rss.channel.item = [];
        for(const productData of localized[language]){
            jsonObj.rss.channel.item.push(productData);
        }
        const fileName = path.join('bin', `${feedName}_${language}.xml`);
        fs.writeFileSync(fileName, xml);
    }




};

module.exports = {
    writeGoogleData
};
