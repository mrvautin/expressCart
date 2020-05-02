/* eslint-disable no-unused-vars */
/* eslint-disable prefer-arrow-callback, no-var, no-tabs */
/* globals AdyenCheckout */
$(document).ready(function (){
    // validate form and show stripe payment
    $('#stripeButton').validator().on('click', function(e){
        e.preventDefault();
        if($('#shipping-form').validator('validate').has('.has-error').length === 0){
            // if no form validation errors
            var handler = window.StripeCheckout.configure({
                key: $('#stripeButton').data('key'),
                image: $('#stripeButton').data('image'),
                locale: 'auto',
                token: function(token){
                    if($('#stripeButton').data('subscription')){
                        $('#shipping-form').append('<input type="hidden" name="stripePlan" value="' + $('#stripeButton').data('subscription') + '" />');
                    }
                    $('#shipping-form').append('<input type="hidden" name="stripeToken" value="' + token.id + '" />');
                    $('#shipping-form').submit();
                }
            });

            // open the stripe payment form
            handler.open({
                email: $('#stripeButton').data('email'),
                name: $('#stripeButton').data('name'),
                description: $('#stripeButton').data('description'),
                zipCode: $('#stripeButton').data('zipCode'),
                amount: $('#stripeButton').data('amount'),
                currency: $('#stripeButton').data('currency'),
                subscription: $('#stripeButton').data('subscription')
            });
        }
    });

    if($('#adyen-dropin').length > 0){
        $.ajax({
            method: 'POST',
            url: '/adyen/setup'
        })
        .done(function(response){
            const configuration = {
                locale: 'en-AU',
                environment: response.environment.toLowerCase(),
                originKey: response.publicKey,
                paymentMethodsResponse: response.paymentsResponse
            };
            const checkout = new AdyenCheckout(configuration);
            checkout
            .create('dropin', {
                paymentMethodsConfiguration: {
                    card: {
                        hasHolderName: false,
                        holderNameRequired: false,
                        enableStoreDetails: false,
                        groupTypes: ['mc', 'visa'],
                        name: 'Credit or debit card'
                    }
                },
                onSubmit: (state, dropin) => {
                    if($('#shipping-form').validator('validate').has('.has-error').length === 0){
                        $.ajax({
                            type: 'POST',
                            url: '/adyen/checkout_action',
                            data: {
                                shipEmail: $('#shipEmail').val(),
                                shipCompany: $('#shipCompany').val(),
                                shipFirstname: $('#shipFirstname').val(),
                                shipLastname: $('#shipLastname').val(),
                                shipAddr1: $('#shipAddr1').val(),
                                shipAddr2: $('#shipAddr2').val(),
                                shipCountry: $('#shipCountry').val(),
                                shipState: $('#shipState').val(),
                                shipPostcode: $('#shipPostcode').val(),
                                shipPhoneNumber: $('#shipPhoneNumber').val(),
                                payment: JSON.stringify(state.data.paymentMethod)
                            }
                        }).done((response) => {
                            window.location = '/payment/' + response.paymentId;
                        }).fail((response) => {
                            showNotification('Failed to complete transaction', 'danger', true);
                        });
                    }
                }
            })
            .mount('#adyen-dropin');
        })
        .fail(function(msg){
            showNotification(msg.responseJSON.message, 'danger');
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
