/* eslint-disable no-unused-vars, prefer-template */
/* eslint-disable prefer-arrow-callback, no-var, no-tabs */
/* globals Stripe, AdyenCheckout, Zip */
$(document).ready(function (){
    // validate form and show stripe payment
    if($('#stripe-form').length > 0){
        $.ajax({
            method: 'POST',
            url: '/stripe/setup'
        })
        .done(async function(response){
            var stripe = Stripe($('#stripePublicKey').val());

            document
                .querySelector('#payment-form')
                .addEventListener('submit', handleSubmit);

            const appearance = {
                theme: 'stripe'
            };
            const elements = stripe.elements({ appearance, clientSecret: response.clientSecret });

            const paymentElement = elements.create('payment');
            paymentElement.mount('#payment-element');

            async function handleSubmit(e){
                e.preventDefault();
                setLoading(true);

                const { error } = await stripe.confirmPayment({
                    elements,
                    confirmParams: {
                        return_url: $('#baseUrl').val() + '/stripe/checkout_action'
                    }
                });

                if(error.type === 'card_error' || error.type === 'validation_error'){
                    showMessage(error.message);
                }else{
                    showMessage('An unexpected error occured.');
                }

                setLoading(false);
            }

            // ------- UI helpers -------
            function showMessage(messageText){
                const messageContainer = document.querySelector('#payment-message');

                messageContainer.classList.remove('hidden');
                messageContainer.textContent = messageText;

                setTimeout(function (){
                    messageContainer.classList.add('hidden');
                    messageText.textContent = '';
                }, 4000);
            }

            // Show a spinner on payment submission
            function setLoading(isLoading){
                if(isLoading){
                    // Disable the button and show a spinner
                    document.querySelector('#submit').disabled = true;
                    document.querySelector('#spinner').classList.remove('d-none');
                    document.querySelector('#button-text').classList.add('d-none');
                }else{
                    document.querySelector('#submit').disabled = false;
                    document.querySelector('#spinner').classList.add('d-none');
                    document.querySelector('#button-text').classList.remove('d-none');
                }
            }
        })
        .fail(function(msg){
            showNotification(msg.responseJSON.message, 'danger');
        });
    };

    if($('#stripe-form2121').length > 0){
        var stripe = Stripe($('#stripePublicKey').val());
        var elements = stripe.elements();
        var style = {
            base: {
                color: '#32325d',
                fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
                fontSmoothing: 'antialiased',
                fontSize: '16px',
                    '::placeholder': {
                    color: '#aab7c4'
                }
            },
            invalid: {
                color: '#fa755a',
                iconColor: '#fa755a'
            }
        };
        // Create an instance of the card Element.
        var card = elements.create('card', { style: style });

        // Add an instance of the card Element into the `card-element` <div>.
        card.mount('#card-element');

        $(document).on('submit', '#stripe-payment-form', function(e){
            e.preventDefault();

            stripe.createToken(card).then(function(response){
                if(response.error){
                    console.log('Stripe err', response.error);
                    showNotification('Failed to complete transaction', 'danger', true);
                }else{
                    $.ajax({
                        type: 'POST',
                        url: '/stripe/checkout_action',
                        data: {
                            token: response.token.id
                        }
                    }).done((response) => {
                        window.location = '/payment/' + response.paymentId;
                    }).fail((response) => {
                        console.log('Stripe err', response.error);
                        window.location = '/payment/' + response.paymentId;
                    });
                }
            });
        });
    }

    $('#checkoutInstore').validator().on('click', function(e){
        e.preventDefault();
        $.ajax({
            type: 'POST',
            url: '/instore/checkout_action'
        }).done((response) => {
            window.location = '/payment/' + response.paymentId;
        }).fail((response) => {
            window.location = '/payment/' + response.paymentId;
        });
    });

    if($('#dropin-container').length > 0){
        $.ajax({
            method: 'POST',
            url: '/adyen/setup'
        })
        .done(async function(response){
            const configuration = {
                environment: response.environment,
                clientKey: response.clientKey,
                session: {
                    id: response.paymentsResponse.id,
                    sessionData: response.paymentsResponse.sessionData
                },
                onPaymentCompleted: (result, component) => {
                    if($('#shipping-form').validator('validate').has('.has-error').length === 0){
                        $.ajax({
                            type: 'POST',
                            url: '/adyen/checkout_action',
                            data: {
                                paymentCode: result.resultCode,
                                paymentId: component._id
                            }
                        }).done((response) => {
                            window.location = '/payment/' + response.paymentId;
                        }).fail((response) => {
                            showNotification('Failed to complete transaction', 'danger', true);
                        });
                    }
                },
                onError: (error, component) => {
                    console.log(error.name, error.message, error.stack, component);
                },
                paymentMethodsConfiguration: {
                    hasHolderName: false,
                    holderNameRequired: false,
                    billingAddressRequired: false
                }
            };
            const checkout = await AdyenCheckout(configuration);
            checkout.create('dropin').mount('#dropin-container');
        })
        .fail(function(msg){
            showNotification(msg.responseJSON.message, 'danger');
        });
    };

    if($('#zip-checkout').length > 0){
        Zip.Checkout.attachButton('#zip-checkout', {
            checkoutUri: '/zip/setup',
            onComplete: function(args){
                if(args.state !== 'approved'){
                    window.location = '/zip/return?result=' + args.state;
                    return;
                }
                $.ajax({
                    type: 'POST',
                    url: '/zip/charge',
                    data: {
                        checkoutId: args.checkoutId
                    }
                }).done((response) => {
                    window.location = '/payment/' + response.paymentId;
                }).fail((response) => {
                    showNotification('Failed to complete transaction', 'danger', true);
                });
            },
            onError: function(args){
                window.location = '/zip/return?result=cancelled';
            }
        });
    };
});

// show notification popup
function showNotification(msg, type, reloadPage, redirect){
    // defaults to false
    reloadPage = reloadPage || false;

    // defaults to null
    redirect = redirect || null;

    // Check for message or fallback to unknown
    if(!msg){
        msg = 'Unknown error has occured. Check inputs.';
    }

    $('#notify_message').removeClass();
    $('#notify_message').addClass('alert-' + type);
    $('#notify_message').html(msg);
    $('#notify_message').slideDown(600).delay(2500).slideUp(600, function(){
        if(redirect){
            window.location = redirect;
        }
        if(reloadPage === true){
            location.reload();
        }
    });
}

function slugify(str){
    var $slug = '';
    var trimmed = $.trim(str);
    $slug = trimmed.replace(/[^a-z0-9-æøå]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .replace(/æ/gi, 'ae')
    .replace(/ø/gi, 'oe')
    .replace(/å/gi, 'a');
    return $slug.toLowerCase();
}
