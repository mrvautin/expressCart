const got = require('got');
const numeral = require('numeral');
const { getPaymentConfig } = require('./config');

const setupVerifone = async(req) => {
    const config = req.app.config;
    const paymentConfig = getPaymentConfig('verifone');
    const base64Auth = Buffer.from(`${paymentConfig.userId}:${paymentConfig.apiKey}`).toString('base64');

    // Create the payload
    const payload = {
        entity_id: paymentConfig.entityId,
        currency_code: paymentConfig.currency,
        amount: numeral(req.session.totalCartAmount).format('0.00').replace('.', ''),
        configurations: {
            card: {
                payment_contract_id: paymentConfig.paymentContract
            }
        },
        interaction_type: 'IFRAME',
        return_url: `${config.baseUrl}/verifone/checkout_return`
    };

    let setupResponse;
    try{
        setupResponse = await got.post(`${paymentConfig.baseUrl}/oidc/checkout-service/v2/checkout`, {
            json: payload,
            headers: {
                'content-type': 'application/json',
                Accept: 'application/json',
                Authorization: `Basic ${base64Auth}`
            },
            rejectUnauthorized: false
        });

        // Parse the response
        setupResponse = JSON.parse(setupResponse.body);

        // Set our Checkout variables
        return {
            id: setupResponse.id,
            url: setupResponse.url
        };
    }catch(ex){
        console.log('ex', ex);
        console.log('payload', payload);
        return {};
    }
};

module.exports = {
    setupVerifone
};
