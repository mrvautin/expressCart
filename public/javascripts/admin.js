/* eslint-disable prefer-arrow-callback, no-var, no-tabs */
/* globals showNotification, slugify */
$(document).ready(function (){
    $(document).on('click', '#btnGenerateAPIkey', function(e){
        e.preventDefault();
        $.ajax({
            method: 'POST',
            url: '/admin/createApiKey'
		})
		.done(function(msg){
            $('#apiKey').val(msg.apiKey);
            showNotification(msg.message, 'success', true);
        })
        .fail(function(msg){
            showNotification(msg.responseJSON.message, 'danger');
        });
    });

    $(document).on('click', '.product_opt_remove', function(e){
        e.preventDefault();
        var name = $(this).closest('li').find('.opt-name').html();

        $.ajax({
            method: 'POST',
            url: '/admin/product/removeoption',
            data: { productId: $('#productId').val(), optName: name }
        })
        .done(function(msg){
            showNotification(msg.message, 'success', true);
        })
        .fail(function(msg){
            showNotification(msg.responseJSON.message, 'danger');
        });
    });

    $(document).on('click', '#product_opt_add', function(e){
        e.preventDefault();

        var optName = $('#product_optName').val();
        var optLabel = $('#product_optLabel').val();
        var optType = $('#product_optType').val();
        var optOptions = $('#product_optOptions').val();

        var optJson = {};
        if($('#productOptions').val() !== '' && $('#productOptions').val() !== '"{}"'){
            optJson = JSON.parse($('#productOptions').val());
        }

        var html = '<li class="list-group-item">';
        html += '<div class="row">';
        html += '<div class="col-lg-2 opt-name">' + optName + '</div>';
        html += '<div class="col-lg-2">' + optLabel + '</div>';
        html += '<div class="col-lg-2">' + optType + '</div>';
        html += '<div class="col-lg-4">' + optOptions + '</div>';
        html += '<div class="col-lg-2 text-right">';
        html += '<button class="product_opt_remove btn btn-danger btn-sm">Remove</button>';
        html += '</div></div></li>';

        // append data
        $('#product_opt_wrapper').append(html);

        // add to the stored json string
        optJson[optName] = {
            optName: optName,
            optLabel: optLabel,
            optType: optType,
            optOptions: $.grep(optOptions.split(','), function(n){ return n === 0 || n; })
        };

        // write new json back to field
        $('#productOptions').val(JSON.stringify(optJson));

        // clear inputs
        $('#product_optName').val('');
        $('#product_optLabel').val('');
        $('#product_optOptions').val('');
    });

    // call update settings API
    $('#settingsForm').validator().on('submit', function(e){
        if(!e.isDefaultPrevented()){
            e.preventDefault();
            // set hidden elements from codemirror editors
            $('#footerHtml_input').val($('.CodeMirror')[0].CodeMirror.getValue());
            $('#googleAnalytics_input').val($('.CodeMirror')[1].CodeMirror.getValue());
            $('#customCss_input').val($('.CodeMirror')[2].CodeMirror.getValue());
            $.ajax({
                method: 'POST',
                url: '/admin/settings/update',
                data: $('#settingsForm').serialize()
            })
            .done(function(msg){
                showNotification(msg.message, 'success');
            })
            .fail(function(msg){
                showNotification(msg.responseJSON.message, 'danger');
            });
        }
    });

    $(document).on('click', '#orderStatusUpdate', function(e){
        $.ajax({
            method: 'POST',
            url: '/admin/order/statusupdate',
            data: { order_id: $('#order_id').val(), status: $('#orderStatus').val() }
        })
		.done(function(msg){
            showNotification(msg.message, 'success', true);
        })
        .fail(function(msg){
            showNotification(msg.responseJSON.message, 'danger');
        });
    });

    $('#productEditForm').validator().on('submit', function(e){
        if(!e.isDefaultPrevented()){
            e.preventDefault();
            if($('#productPermalink').val() === '' && $('#productTitle').val() !== ''){
                $('#productPermalink').val(slugify($('#productTitle').val()));
            }
            $.ajax({
                method: 'POST',
                url: '/admin/product/update',
                data: {
                    productId: $('#productId').val(),
                    productTitle: $('#productTitle').val(),
                    productPrice: $('#productPrice').val(),
                    productPublished: $('#productPublished').val(),
                    productStock: $('#productStock').val(),
                    productDescription: $('#productDescription').val(),
                    productPermalink: $('#productPermalink').val(),
                    productOptions: $('#productOptions').val(),
                    productSubscription: $('#productSubscription').val(),
                    productComment: $('#productComment').is(':checked'),
                    productTags: $('#productTags').val()
                }
            })
            .done(function(msg){
                showNotification(msg.message, 'success', true);
            })
            .fail(function(msg){
                showNotification(msg.responseJSON.message, 'danger');
            });
        }
    });

    $('.set-as-main-image').on('click', function(){
        $.ajax({
            method: 'POST',
            url: '/admin/product/setasmainimage',
            data: { product_id: $('#productId').val(), productImage: $(this).attr('data-id') }
        })
		.done(function(msg){
            showNotification(msg.message, 'success', true);
        })
        .fail(function(msg){
            showNotification(msg.responseJSON.message, 'danger');
        });
    });

    $('.btn-delete-image').on('click', function(){
        $.ajax({
            method: 'POST',
            url: '/admin/product/deleteimage',
            data: { product_id: $('#productId').val(), productImage: $(this).attr('data-id') }
        })
		.done(function(msg){
            showNotification(msg.message, 'success', true);
        })
        .fail(function(msg){
            showNotification(msg.responseJSON.message, 'danger');
        });
    });

    $('.btn-delete-product').on('click', function(){
        $.ajax({
            method: 'POST',
            url: '/admin/product/delete',
            data: { productId: $(this).attr('data-id') }
        })
		.done(function(msg){
            showNotification(msg.message, 'success', true);
        })
        .fail(function(msg){
            showNotification(msg.responseJSON.message, 'danger');
        });
    });

	// Call to API to check if a permalink is available
    $(document).on('click', '#validate_permalink', function(e){
        if($('#productPermalink').val() !== ''){
            $.ajax({
                method: 'POST',
                url: '/admin/api/validate_permalink',
                data: { permalink: $('#productPermalink').val(), docId: $('#productId').val() }
            })
            .done(function(msg){
                showNotification(msg.message, 'success');
            })
            .fail(function(msg){
                showNotification(msg.responseJSON.message, 'danger');
            });
        }else{
            showNotification('Please enter a permalink to validate', 'danger');
        }
    });

    // applies an product filter
    $(document).on('click', '#btn_product_filter', function(e){
        if($('#product_filter').val() !== ''){
            window.location.href = '/admin/products/filter/' + $('#product_filter').val();
        }else{
            showNotification('Please enter a keyword to filter', 'danger');
        }
    });

    // applies an order filter
    $(document).on('click', '#btn_order_filter', function(e){
        if($('#order_filter').val() !== ''){
            window.location.href = '/admin/orders/filter/' + $('#order_filter').val();
        }else{
            showNotification('Please enter a keyword to filter', 'danger');
        }
    });

    // applies an product filter
    $(document).on('click', '#btn_customer_filter', function(e){
        if($('#customer_filter').val() !== ''){
            window.location.href = '/admin/customers/filter/' + $('#customer_filter').val();
        }else{
            showNotification('Please enter a keyword to filter', 'danger');
        }
    });

    $('#sendTestEmail').on('click', function(e){
        e.preventDefault();
        $.ajax({
            method: 'POST',
            url: '/admin/testEmail'
		})
		.done(function(msg){
            showNotification(msg, 'success');
        })
        .fail(function(msg){
            showNotification(msg.responseJSON.message, 'danger');
        });
    });

    $(document).on('click', '.orderFilterByStatus', function(e){
        e.preventDefault();
        window.location = '/admin/orders/bystatus/' + $('#orderStatusFilter').val();
    });

    // Call to API for a change to the published state of a product
    $('input[class="published_state"]').change(function(){
        $.ajax({
            method: 'POST',
            url: '/admin/product/published_state',
            data: { id: this.id, state: this.checked }
        })
		.done(function(msg){
            showNotification(msg.message, 'success');
        })
        .fail(function(msg){
            showNotification(msg.responseJSON.message, 'danger');
        });
    });

    // call update settings API
    $('#updateCustomer').validator().on('click', function(e){
        e.preventDefault();
        if($('#customer-form').validator('validate').has('.has-error').length === 0){
            $.ajax({
                method: 'POST',
                url: '/admin/customer/update',
                data: {
                    customerId: $('#customerId').val(),
                    email: $('#email').val(),
                    firstName: $('#firstName').val(),
                    lastName: $('#lastName').val(),
                    address1: $('#address1').val(),
                    address2: $('#address2').val(),
                    country: $('#country').val(),
                    state: $('#state').val(),
                    postcode: $('#postcode').val(),
                    phone: $('#phone').val()
                }
            })
            .done(function(msg){
                showNotification(msg.message, 'success');
            })
            .fail(function(msg){
                showNotification(msg.responseJSON.message, 'danger');
            });
        }
    });

    // call update settings API
    $('#deleteCustomer').on('click', function(e){
        e.preventDefault();
        $.ajax({
            method: 'DELETE',
            url: '/admin/customer',
            data: {
                customerId: $('#customerId').val()
            }
        })
        .done(function(msg){
            showNotification(msg.message, 'success', false, '/admin/customers');
        })
        .fail(function(msg){
            showNotification(msg.responseJSON.message, 'danger');
        });
    });

    if($('#footerHtml').length){
        var footerHTML = window.CodeMirror.fromTextArea(document.getElementById('footerHtml'), {
            mode: 'xml',
            tabMode: 'indent',
            theme: 'flatly',
            lineNumbers: true,
            htmlMode: true,
            fixedGutter: false
        });

        footerHTML.setValue(footerHTML.getValue());
    }

    if($('#googleAnalytics').length){
        window.CodeMirror.fromTextArea(document.getElementById('googleAnalytics'), {
            mode: 'xml',
            tabMode: 'indent',
            theme: 'flatly',
            lineNumbers: true,
            htmlMode: true,
            fixedGutter: false
        });
    }

    if($('#customCss').length){
        var customCss = window.CodeMirror.fromTextArea(document.getElementById('customCss'), {
            mode: 'text/css',
            tabMode: 'indent',
            theme: 'flatly',
            lineNumbers: true
        });

        var customCssBeautified = window.cssbeautify(customCss.getValue(), {
            indent: '   ',
            autosemicolon: true
        });
        customCss.setValue(customCssBeautified);
    }

    $(document).on('click', '#btnPageUpdate', function(e){
        e.preventDefault();
        $.ajax({
            method: 'POST',
            url: '/admin/settings/page',
            data: {
                pageId: $('#pageId').val(),
                pageName: $('#pageName').val(),
                pageSlug: $('#pageSlug').val(),
                pageEnabled: $('#pageEnabled').is(':checked'),
                pageContent: $('#pageContent').val()
            }
        })
        .done(function(msg){
            showNotification(msg.message, 'success', true);
        })
        .fail(function(msg){
            showNotification(msg.responseJSON.message, 'danger');
        });
    });

    $(document).on('click', '#btnPageDelete', function(e){
        e.preventDefault();
        if(confirm('Are you sure?')){
            $.ajax({
                method: 'POST',
                url: '/admin/settings/page/delete',
                data: {
                    pageId: $(this).attr('data-id')
                }
            })
            .done(function(msg){
                showNotification(msg.message, 'success', true);
            })
            .fail(function(msg){
                showNotification(msg.message, 'danger', true);
            });
        }
    });

    $(document).on('click', '#settings-menu-new', function(e){
        e.preventDefault();
        $.ajax({
            method: 'POST',
            url: '/admin/settings/menu/new',
            data: {
                navMenu: $('#newNavMenu').val(),
                navLink: $('#newNavLink').val()
            }
        })
        .done(function(msg){
            showNotification(msg.message, 'success', true);
        })
        .fail(function(msg){
            showNotification(msg.message, 'danger', true);
        });
    });

    $(document).on('click', '#settings-menu-update', function(e){
        e.preventDefault();
        var id = $(this).attr('data-id');
        var parentEl = $('#menuId-' + id);
        $.ajax({
            method: 'POST',
            url: '/admin/settings/menu/update',
            data: {
                navId: parentEl.find('.navId').val(),
                navMenu: parentEl.find('.navMenu').val(),
                navLink: parentEl.find('.navLink').val()
            }
        })
        .done(function(msg){
            showNotification(msg.message, 'success', true);
        })
        .fail(function(msg){
            showNotification(msg.message, 'danger', true);
        });
    });

    $(document).on('click', '.settings-menu-delete', function(e){
        e.preventDefault();

        if(confirm('Are you sure?')){
            $.ajax({
                method: 'POST',
                url: '/admin/settings/menu/delete',
                data: {
                    menuId: $(this).attr('data-id')
                }
            })
            .done(function(msg){
                showNotification(msg.message, 'success', true);
            })
            .fail(function(msg){
                showNotification(msg.message, 'danger', true);
            });
        }
    });

    $(document).on('click', '#uploadButton', function(e){
        e.preventDefault();
        var formData = new FormData($('#uploadForm')[0]);
        formData.append('productId', $('#productId').val());

        // Upload file
        $.ajax({
            method: 'POST',
            url: '/admin/file/upload',
            processData: false,
            contentType: false,
            cache: false,
            data: formData
        })
        .done(function(msg){
            showNotification(msg.message, 'success', true);
        })
        .fail(function(msg){
            showNotification(msg.responseJSON.message, 'danger');
        });
    });
});
