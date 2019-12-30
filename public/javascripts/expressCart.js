/* eslint-disable prefer-arrow-callback, no-var, no-tabs */
/* globals showNotification */
$(document).ready(function (){
    if($(window).width() < 768){
        $('.menu-side').on('click', function(e){
            e.preventDefault();
            $('.menu-side li:not(".active")').slideToggle();
        });

        $('.menu-side li:not(".active")').hide();
        $('.menu-side>.active').html('<i class="fa fa-bars" aria-hidden="true"></i>');
        $('.menu-side>.active').addClass('menu-side-mobile');

        // hide menu if there are no items in it
        if($('#navbar ul li').length === 0){
            $('#navbar').hide();
        }

        $('#offcanvasClose').hide();
    }

    // If cart was open before reload, open it again
    var isCartOpen = (localStorage.getItem('cartOpen') === 'true');
    if(isCartOpen === true){
        localStorage.setItem('cartOpen', false);
        $('body').addClass('pushy-open-right');
    }

    $('#userSetupForm').validator().on('submit', function(e){
        if(!e.isDefaultPrevented()){
            e.preventDefault();
            $.ajax({
                method: 'POST',
                url: '/admin/setup_action',
                data: {
                    usersName: $('#usersName').val(),
                    userEmail: $('#userEmail').val(),
                    userPassword: $('#userPassword').val()
                }
            })
            .done(function(msg){
                showNotification(msg.message, 'success', false, '/admin/login');
            })
            .fail(function(msg){
                showNotification(msg.responseJSON.message, 'danger');
            });
        }
    });

    $(document).on('click', '.menu-btn', function(e){
        e.preventDefault();
        $('body').addClass('pushy-open-right');
    });

	// add the table class to all tables
    $('table').each(function(){
        $(this).addClass('table table-hover');
    });

    if($('#productTags').length){
        $('#productTags').tokenfield();
    }

    $(document).on('click', '.dashboard_list', function(e){
        window.document.location = $(this).attr('href');
    }).hover(function(){
        $(this).toggleClass('hover');
    });

    $(document).on('click', '.btn-qty-minus', function(e){
        e.preventDefault();
        var qtyElement = $(e.target).parent().parent().find('.cart-product-quantity');
        $(qtyElement).val(parseInt(qtyElement.val()) - 1);
        cartUpdate(qtyElement);
    });

    $(document).on('click', '.btn-qty-add', function(e){
        e.preventDefault();
        var qtyElement = $(e.target).parent().parent().find('.cart-product-quantity');
        $(qtyElement).val(parseInt(qtyElement.val()) + 1);
        cartUpdate(qtyElement);
    });

    $(document).on('click', '.btn-delete-from-cart', function(e){
        deleteFromCart($(e.target));
    });

    if($('#pager').length){
        var pageNum = $('#pageNum').val();
        var pageLen = $('#productsPerPage').val();
        var productCount = $('#totalProductCount').val();
        var paginateUrl = $('#paginateUrl').val();
        var searchTerm = $('#searchTerm').val();

        if(searchTerm !== ''){
            searchTerm = searchTerm + '/';
        }

        var pagerHref = '/' + paginateUrl + '/' + searchTerm + '{{number}}';
        var totalProducts = Math.ceil(productCount / pageLen);

        if(parseInt(productCount) > parseInt(pageLen)){
            $('#pager').bootpag({
                total: totalProducts,
                page: pageNum,
                maxVisible: 5,
                href: pagerHref,
                wrapClass: 'pagination',
                prevClass: 'page-item previous',
                nextClass: 'page-item next',
                activeClass: 'page-item active'
            });

            // Fix for Bootstrap 4
            $('#pager a').each(function(){
                $(this).addClass('page-link');
            });
        }
    }

    $('#customerLogout').on('click', function(e){
        $.ajax({
            method: 'POST',
            url: '/customer/logout',
            data: {}
        })
        .done(function(msg){
            location.reload();
        });
    });

    $('#customerForgotten').validator().on('submit', function(e){
        if(!e.isDefaultPrevented()){
            e.preventDefault();
            $.ajax({
                method: 'POST',
                url: '/customer/forgotten_action',
                data: {
                    email: $('#email').val()
                }
            })
            .done(function(msg){
                showNotification(msg.message, 'success');
            })
            .fail(function(msg){
                if(msg.message){
                    showNotification(msg.responseJSON.message, 'danger');
                    return;
                }
                showNotification(msg.responseText, 'danger');
            });
        }
    });

    $(document).on('click', '#createAccountCheckbox', function(e){
        $('#newCustomerPassword').prop('required', $('#createAccountCheckbox').prop('checked'));
    });

    $('#checkoutInformation').validator().on('click', function(e){
        console.log('here?');
        e.preventDefault();
        if($('#shipping-form').validator('validate').has('.has-error').length === 0){
            // Change route if customer to be saved for later
            var route = '/customer/save';
            if($('#createAccountCheckbox').prop('checked')){
                route = '/customer/create';
            }
            $.ajax({
                method: 'POST',
                url: route,
                data: {
                    email: $('#shipEmail').val(),
                    firstName: $('#shipFirstname').val(),
                    lastName: $('#shipLastname').val(),
                    address1: $('#shipAddr1').val(),
                    address2: $('#shipAddr2').val(),
                    country: $('#shipCountry').val(),
                    state: $('#shipState').val(),
                    postcode: $('#shipPostcode').val(),
                    phone: $('#shipPhoneNumber').val(),
                    password: $('#newCustomerPassword').val(),
                    orderComment: $('#orderComment').val()
                }
            })
            .done(function(){
                window.location = '/checkout/shipping';
            })
            .fail(function(msg){
                showNotification(msg.responseJSON.message, 'danger');
            });
        }
    });

    $('#loginForm').on('click', function(e){
        if(!e.isDefaultPrevented()){
            e.preventDefault();
            $.ajax({
                method: 'POST',
                url: '/admin/login_action',
                data: {
                    email: $('#email').val(),
                    password: $('#password').val()
                }
            })
            .done(function(msg){
                window.location = '/admin';
            })
            .fail(function(msg){
                showNotification(msg.responseJSON.message, 'danger');
            });
        }
        e.preventDefault();
    });

    // call update settings API
    $('#customerLogin').on('click', function(e){
        if(!e.isDefaultPrevented()){
            e.preventDefault();
            $.ajax({
                method: 'POST',
                url: '/customer/login_action',
                data: {
                    loginEmail: $('#customerLoginEmail').val(),
                    loginPassword: $('#customerLoginPassword').val()
                }
            })
            .done(function(msg){
                var customer = msg.customer;
                // Fill in customer form
                $('#shipEmail').val(customer.email);
                $('#shipFirstname').val(customer.firstName);
                $('#shipLastname').val(customer.lastName);
                $('#shipAddr1').val(customer.address1);
                $('#shipAddr2').val(customer.address2);
                $('#shipCountry').val(customer.country);
                $('#shipState').val(customer.state);
                $('#shipPostcode').val(customer.postcode);
                $('#shipPhoneNumber').val(customer.phone);
                location.reload();
            })
            .fail(function(msg){
                showNotification(msg.responseJSON.message, 'danger');
            });
        }
        e.preventDefault();
    });

    $(document).on('click', '.image-next', function(e){
        var thumbnails = $('.thumbnail-image');
        var index = 0;
        var matchedIndex = 0;

        // get the current src image and go to the next one
        $('.thumbnail-image').each(function(){
            if($('#product-title-image').attr('src') === $(this).attr('src')){
                if(index + 1 === thumbnails.length || index + 1 < 0){
                    matchedIndex = 0;
                }else{
                    matchedIndex = index + 1;
                }
            }
            index++;
        });

        // set the image src
        $('#product-title-image').attr('src', $(thumbnails).eq(matchedIndex).attr('src'));
    });

    $(document).on('click', '.image-prev', function(e){
        var thumbnails = $('.thumbnail-image');
        var index = 0;
        var matchedIndex = 0;

        // get the current src image and go to the next one
        $('.thumbnail-image').each(function(){
            if($('#product-title-image').attr('src') === $(this).attr('src')){
                if(index - 1 === thumbnails.length || index - 1 < 0){
                    matchedIndex = thumbnails.length - 1;
                }else{
                    matchedIndex = index - 1;
                }
            }
            index++;
        });

        // set the image src
        $('#product-title-image').attr('src', $(thumbnails).eq(matchedIndex).attr('src'));
    });

    $(document).on('click', '.product-add-to-cart', function(e){
        var productOptions = getSelectedOptions();

        if(parseInt($('#product_quantity').val()) < 0){
            $('#product_quantity').val(0);
        }

        $.ajax({
            method: 'POST',
            url: '/product/addtocart',
            data: {
                productId: $('#productId').val(),
                productQuantity: $('#product_quantity').val(),
                productOptions: JSON.stringify(productOptions),
                productComment: $('#product_comment').val()
            }
        })
		.done(function(msg){
            $('#cart-count').text(msg.totalCartItems);
            showNotification(msg.message, 'success', true);
        })
        .fail(function(msg){
            showNotification(msg.responseJSON.message, 'danger');
        });
    });

    $('.cart-product-quantity').on('focusout', function(e){
        cartUpdate($(e.target));
    });

    $(document).on('click', '.pushy-link', function(e){
        $('body').removeClass('pushy-open-right');
    });

    $(document).on('click', '.add-to-cart', function(e){
        var productLink = '/product/' + $(this).attr('data-id');
        if($(this).attr('data-link')){
            productLink = '/product/' + $(this).attr('data-link');
        }

        if($(this).attr('data-has-options') === 'true'){
            window.location = productLink;
        }else{
            $.ajax({
                method: 'POST',
                url: '/product/addtocart',
                data: { productId: $(this).attr('data-id') }
            })
            .done(function(msg){
                $('#cart-count').text(msg.totalCartItems);
                showNotification(msg.message, 'success', true);
            })
            .fail(function(msg){
                showNotification(msg.responseJSON.message, 'danger');
            });
        }
    });

    $(document).on('click', '#empty-cart', function(e){
        $.ajax({
            method: 'POST',
            url: '/product/emptycart'
        })
		.done(function(msg){
            $('#cart-count').text(msg.totalCartItems);
            showNotification(msg.message, 'success', true);
        });
    });

    $('.qty-btn-minus').on('click', function(){
        var number = parseInt($('#product_quantity').val()) - 1;
        $('#product_quantity').val(number > 0 ? number : 1);
    });

    $('.qty-btn-plus').on('click', function(){
        $('#product_quantity').val(parseInt($('#product_quantity').val()) + 1);
    });

    // product thumbnail image click
    $('.thumbnail-image').on('click', function(){
        $('#product-title-image').attr('src', $(this).attr('src'));
    });

    // resets the order filter
    $(document).on('click', '#btn_search_reset', function(e){
        window.location.replace('/');
    });

    // search button click event
    $(document).on('click', '#btn_search', function(e){
        e.preventDefault();
        if($('#frm_search').val().trim() === ''){
            showNotification('Please enter a search value', 'danger');
        }else{
            window.location.href = '/search/' + $('#frm_search').val();
        }
    });

    if($('#input_notify_message').val() !== ''){
		// save values from inputs
        var messageVal = $('#input_notify_message').val();
        var messageTypeVal = $('#input_notify_messageType').val();

		// clear inputs
        $('#input_notify_message').val('');
        $('#input_notify_messageType').val('');

		// alert
        showNotification(messageVal, messageTypeVal || 'danger', false);
    }
});

function deleteFromCart(element){
    $.ajax({
        method: 'POST',
        url: '/product/removefromcart',
        data: { productId: element.attr('data-id') }
    })
    .done(function(msg){
        setCartOpen();
        showNotification(msg.message, 'success', true);
    })
    .fail(function(msg){
        showNotification(msg.responseJSON.message, 'danger');
    });
}

function cartUpdate(element){
    if($(element).val() > 0){
        if($(element).val() !== ''){
            updateCart(element);
        }
    }else{
        $(element).val(1);
    }
}

function setCartOpen(){
    if($('body').hasClass('pushy-open-right') === true){
        localStorage.setItem('cartOpen', true);
    }else{
        localStorage.setItem('cartOpen', false);
    }
}

function updateCart(element){
    // update cart on server
    $.ajax({
        method: 'POST',
        url: '/product/updatecart',
        data: {
            productId: element.attr('data-id'),
            quantity: element.val()
        }
    })
    .done(function(msg){
        setCartOpen();
        showNotification(msg.message, 'success', true);
    })
    .fail(function(msg){
        showNotification(msg.responseJSON.message, 'danger', true);
    });
}

function getSelectedOptions(){
    var options = {};
    $('.product-opt').each(function(){
        if($(this).attr('name') === 'opt-'){
            options[$(this).val().trim()] = $(this).prop('checked');
            return;
        }
        var optionValue = $(this).val().trim();
        if($(this).attr('type') === 'radio'){
            optionValue = $('input[name="' + $(this).attr('name') + '"]:checked').val();
        }
        options[$(this).attr('name').substring(4, $(this).attr('name').length)] = optionValue;
    });
    return options;
}
