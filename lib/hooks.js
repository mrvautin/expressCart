const EventEmitter = require('events');
const axios = require("axios");
const hookEmitter = new EventEmitter();
const config = require("./config").getConfig();

//support for previous config style
if (config.orderHook){
    registerHook({typeOfHook : "order", eventOfHook : "onCreate", callbackUrl : config.orderHook});
}

for (const typeOfHook in config.hooks) {
    const hookEvents = config.hooks[typeOfHook];
    for (const eventOfHook in hookEvents) {
        const callbackUrl = hookEvents[eventOfHook];
            registerHook({typeOfHook, eventOfHook, callbackUrl});
    }
}


function registerHook ({typeOfHook,eventOfHook,callbackUrl}){
    if(callbackUrl === "") return;

    console.log(`register ${typeOfHook} ${eventOfHook} on url ${callbackUrl}`)
    hookEmitter.on(`${typeOfHook}_${eventOfHook}`, async payload => {
        console.log(`calling hook ${typeOfHook} ${eventOfHook} on url ${callbackUrl}`)
        try {
            const response = await axios.post(callbackUrl, payload, {responseType: 'application/json'})
            if (200 <= response.status && response.status <= 299) {
                console.info(`Successfully called order ${typeOfHook} ${eventOfHook} `);
            } else {
                throw (`not a 2xx response ${response.status} `);
            }
        } catch (e) {
            console.error('Error calling hook:', e);
        }
    })
}

module.exports = hookEmitter;




