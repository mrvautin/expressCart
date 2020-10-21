/* eslint-disable prefer-arrow-callback, no-var, no-tabs, prefer-template */
/* globals showNotification, slugify, numeral, moment, feather */
$(document).ready(function (){
    $.ajaxSetup({
        headers: {
            'csrf-token': $('meta[name="csrfToken"]').attr('content')
        }
    });

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

    $(document).on('click', '.removeVariant', function(e){
        e.preventDefault();

        $.ajax({
            method: 'POST',
            url: '/admin/product/removevariant',
            data: { variant: $(this).attr('data-id') }
        })
        .done(function(msg){
            showNotification(msg.message, 'success', true);
        })
        .fail(function(msg){
            showNotification(msg.responseJSON.message, 'danger');
        });
    });

    $(document).on('click', '.editVariant', function(e){
        e.preventDefault();
    });

    $(document).on('click', '#saveVariant', function(e){
        e.preventDefault();

        $.ajax({
            method: 'POST',
            url: '/admin/product/editvariant',
            data: {
                product: $('#variant-edit-product').val(),
                variant: $('#variant-edit-id').val(),
                title: $('#variant-edit-title').val(),
                price: $('#variant-edit-price').val(),
                stock: $('#variant-edit-stock').val()
            }
        })
        .done(function(msg){
            showNotification(msg.message, 'success', true);
        })
        .fail(function(msg){
            showNotification(msg.responseJSON.message, 'danger');
        });
    });

    // Variant modal
    $('#variantEditModal').on('shown.bs.modal', function (e){
        $('#variant-edit-title').focus();
        $('#variant-edit-id').val($(e.relatedTarget).data('id'));
        $('#variant-edit-title').val($(e.relatedTarget).data('title'));
        $('#variant-edit-price').val($(e.relatedTarget).data('price'));
        $('#variant-edit-stock').val($(e.relatedTarget).data('stock'));
    });

    $(document).on('click', '#addVariant', function(e){
        $.ajax({
            method: 'POST',
            url: '/admin/product/addvariant',
            data: {
                product: $('#variant-product').val(),
                title: $('#variant-title').val(),
                price: $('#variant-price').val(),
                stock: $('#variant-stock').val()
            }
        })
		.done(function(msg){
            showNotification(msg.message, 'success', true);
        })
        .fail(function(msg){
            showNotification(msg.responseJSON.message, 'danger');
        });
    });

    $(document).on('click', '#btnSettingsUpdate', function(e){
        $('#settingsForm').submit();
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

    $(document).on('click', '#btnUserAdd', function(e){
        $('#userNewForm').submit();
    });

    $('#userNewForm').validator().on('submit', function(e){
        if(!e.isDefaultPrevented()){
            e.preventDefault();
            $.ajax({
                method: 'POST',
                url: '/admin/user/insert',
                data: {
                    usersName: $('#usersName').val(),
                    userEmail: $('#userEmail').val(),
                    userPassword: $('#userPassword').val()
                }
            })
            .done(function(msg){
                showNotification(msg.message, 'success', false, '/admin/user/edit/' + msg.userId);
            })
            .fail(function(msg){
                showNotification(msg.responseJSON.message, 'danger');
            });
        }
    });

    $('.userDelete').on('click', function(){
        if(confirm('Are you sure you want to delete?')){
            $.ajax({
                method: 'POST',
                url: '/admin/user/delete',
                data: {
                    userId: $(this).attr('data-id')
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

    $(document).on('click', '#btnUserEdit', function(e){
        $('#userEditForm').submit();
    });

    $('#userEditForm').validator().on('submit', function(e){
        if(!e.isDefaultPrevented()){
            e.preventDefault();
            $.ajax({
                method: 'POST',
                url: '/admin/user/update',
                data: {
                    userId: $('#userId').val(),
                    usersName: $('#usersName').val(),
                    userEmail: $('#userEmail').val(),
                    userPassword: $('#userPassword').val(),
                    userAdmin: $('#userPassword').is(':checked')
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

    $('#productNewForm').validator().on('submit', function(e){
        if(!e.isDefaultPrevented()){
            e.preventDefault();
            if($('#productPermalink').val() === '' && $('#productTitle').val() !== ''){
                $('#productPermalink').val(slugify($('#productTitle').val()));
            }
            $.ajax({
                method: 'POST',
                url: '/admin/product/insert',
                data: {
                    productTitle: $('#productTitle').val(),
                    productPrice: $('#productPrice').val(),
                    productPublished: $('#productPublished').val(),
                    productStock: $('#productStock').val(),
                    productDescription: $('#productDescription').val(),
                    productGtin: $('#productGtin').val(),
                    productBrand: $('#productBrand').val(),
                    productPermalink: $('#productPermalink').val(),
                    productSubscription: $('#productSubscription').val(),
                    productComment: $('#productComment').is(':checked'),
                    productTags: $('#productTags').val()
                }
            })
            .done(function(msg){
                showNotification(msg.message, 'success', false, '/admin/product/edit/' + msg.productId);
            })
            .fail(function(msg){
                if(msg.responseJSON.length > 0){
                    var errorMessages = validationErrors(msg.responseJSON);
                    $('#validationModalBody').html(errorMessages);
                    $('#validationModal').modal('show');
                    return;
                }
                showNotification(msg.responseJSON.message, 'danger');
            });
        }
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
                    productStockDisable: $('#productStockDisable').is(':checked'),
                    productDescription: $('#productDescription').val(),
                    productGtin: $('#productGtin').val(),
                    productBrand: $('#productBrand').val(),
                    productPermalink: $('#productPermalink').val(),
                    productSubscription: $('#productSubscription').val(),
                    productComment: $('#productComment').is(':checked'),
                    productTags: $('#productTags').val()
                }
            })
            .done(function(msg){
                showNotification(msg.message, 'success', true);
            })
            .fail(function(msg){
                if(msg.responseJSON.length > 0){
                    var errorMessages = validationErrors(msg.responseJSON);
                    console.log('errorMessages', errorMessages);
                    $('#validationModalBody').html(errorMessages);
                    $('#validationModal').modal('show');
                    return;
                }
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
        if(confirm('Are you sure you want to delete this image?')){
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
        }
    });

    $('.btn-delete-product').on('click', function(){
        if(confirm('Are you sure you want to delete this product?')){
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
        }
    });

    $('.btn-delete-review').on('click', function(){
        if(confirm('Are you sure you want to delete this review?')){
            $.ajax({
                method: 'POST',
                url: '/admin/review/delete',
                data: { reviewId: $(this).attr('data-id') }
            })
            .done(function(msg){
                showNotification(msg.message, 'success', true);
            })
            .fail(function(msg){
                showNotification(msg.responseJSON.message, 'danger');
            });
        }
    });

	// Call to API to check if a permalink is available
    $(document).on('click', '#validatePermalink', function(e){
        if($('#productPermalink').val() !== ''){
            $.ajax({
                method: 'POST',
                url: '/admin/validatePermalink',
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

    // applies an customer filter
    $(document).on('click', '#btn_customer_filter', function(e){
        if($('#customer_filter').val() !== ''){
            window.location.href = '/admin/customers/filter/' + $('#customer_filter').val();
        }else{
            showNotification('Please enter a keyword to filter', 'danger');
        }
    });

    // applies an review filter
    $(document).on('click', '#btn_review_filter', function(e){
        if($('#review_filter').val() !== ''){
            window.location.href = '/admin/reviews/filter/' + $('#review_filter').val();
        }else{
            showNotification('Please enter a keyword to filter', 'danger');
        }
    });

    $(document).on('click', '#lookupCustomer', function(e){
        e.preventDefault();
        $.ajax({
            method: 'POST',
            url: '/admin/customer/lookup',
            data: {
                customerEmail: $('#customerEmail').val()
            }
		})
		.done(function(result){
            showNotification(result.message, 'success');
            $('#orderFirstName').val(result.customer.firstName);
            $('#orderLastName').val(result.customer.lastName);
            $('#orderAddress1').val(result.customer.address1);
            $('#orderAddress2').val(result.customer.address2);
            $('#orderCountry').val(result.customer.country);
            $('#orderState').val(result.customer.state);
            $('#orderPostcode').val(result.customer.postcode);
            $('#orderPhone').val(result.customer.phone);
        })
        .fail(function(msg){
            showNotification(msg.responseJSON.message, 'danger');
        });
    });

    $(document).on('click', '#orderCreate', function(e){
        e.preventDefault();
        if($('#createOrderForm').validator('validate').has('.has-error').length === 0){
            $.ajax({
                method: 'POST',
                url: '/admin/order/create',
                data: {
                    orderStatus: $('#orderStatus').val(),
                    email: $('#customerEmail').val(),
                    firstName: $('#orderFirstName').val(),
                    lastName: $('#orderLastName').val(),
                    address1: $('#orderAddress1').val(),
                    address2: $('#orderAddress2').val(),
                    country: $('#orderCountry').val(),
                    state: $('#orderState').val(),
                    postcode: $('#orderPostcode').val(),
                    phone: $('#orderPhone').val(),
                    orderComment: $('#orderComment').val()
                }
            })
            .done(function(result){
                showNotification(result.message, 'success');
                window.location = `/admin/order/view/${result.orderId}`;
            })
            .fail(function(msg){
                showNotification(msg.responseJSON.message, 'danger');
            });
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
    $('input[class="publishedState"]').change(function(){
        $.ajax({
            method: 'POST',
            url: '/admin/product/publishedState',
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

    $('#discountNewForm').validator().on('submit', function(e){
        if(!e.isDefaultPrevented()){
            e.preventDefault();
            $.ajax({
                method: 'POST',
                url: '/admin/settings/discount/create',
                data: {
                    code: $('#discountCode').val(),
                    type: $('#discountType').val(),
                    value: $('#discountValue').val(),
                    start: $('#discountStart').val(),
                    end: $('#discountEnd').val()
                }
            })
            .done(function(msg){
                showNotification(msg.message, 'success', false, '/admin/settings/discount/edit/' + msg.discountId);
            })
            .fail(function(msg){
                showNotification(msg.responseJSON.message, 'danger');
            });
        }
    });

    $('#discountEditForm').validator().on('submit', function(e){
        if(!e.isDefaultPrevented()){
            e.preventDefault();
            $.ajax({
                method: 'POST',
                url: '/admin/settings/discount/update',
                data: {
                    discountId: $('#discountId').val(),
                    code: $('#discountCode').val(),
                    type: $('#discountType').val(),
                    value: $('#discountValue').val(),
                    start: $('#discountStart').val(),
                    end: $('#discountEnd').val()
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

    $('#discountStart').datetimepicker({
        uiLibrary: 'bootstrap4',
        footer: true,
        modal: true,
        format: 'dd/mm/yyyy HH:MM',
        showOtherMonths: true
    });
    $('#discountEnd').datetimepicker({
        uiLibrary: 'bootstrap4',
        footer: true,
        modal: true,
        format: 'dd/mm/yyyy HH:MM'
    });

    $(document).on('click', '#btnDiscountDelete', function(e){
        e.preventDefault();
        if(confirm('Are you sure?')){
            $.ajax({
                method: 'DELETE',
                url: '/admin/settings/discount/delete',
                data: {
                    discountId: $(this).attr('data-id')
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

    if($('#draggable_list').length){
        $('#draggable_list').sortable({
            update: function (){
                var menuOrder = [];
                $('.navId').each(function(val){
                    menuOrder.push($($('.navId')[val]).val());
                });
                $.ajax({
                    data: { order: menuOrder },
                    type: 'POST',
                    url: '/admin/settings/menu/saveOrder'
                })
                .done(function(){
                    showNotification('Menu order saved', 'success', true);
                })
                .fail(function(msg){
                    showNotification(msg.responseJSON.message, 'danger', true);
                });
            }
        });
    }

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

    $('#global-search-value').on('keyup', (e) => {
        if($('#global-search-value').val() === ''){
            $('#global-search-results').empty();
            $('#global-search-results').addClass('invisible');
        }

        let minLength = 3;
        if(/^\d*\.?\d*$/.test($('#global-search-value').val())){
            minLength = 1;
        }

        // Search when 3 or more characters are entered
        if($('#global-search-value').val().length > minLength){
            $('#global-search').html('<span class="fa fa-spinner fa-spin"></span>');
            globalSearch();
        }
    });

    $('#globalSearchModal').on('shown.bs.modal', function (){
        $('#global-search-value').focus();
    });

    $('body').on('click', '.gr-click', (e) => {
        $('#global-search-value').val();
        const url = $(e.currentTarget).closest('.global-result').attr('data-url');
        if(url){
            window.location = url;
        }
    });
});

function globalSearch(){
    $('#global-search-results').empty();
    $.ajax({
        type: 'POST',
        url: '/admin/searchall',
        data: {
            searchValue: $('#global-search-value').val()
        }
    }).done((res) => {
        $('#global-search').html('<i class="feather" data-feather="search"></i>');
        let hasResult = false;
        res.customers.forEach((value) => {
            hasResult = true;
            const result = `
            <li class="list-group-item global-result text-center" data-url="/admin/customer/view/${value._id}">
                <div class="row">
                <div class="col global-result-type gr-click"><i class="feather" data-feather="user"></i> Customer</div>
                <div class="col global-result-detail gr-click">${value.firstName} ${value.lastName}</div>
                <div class="col global-result-detail gr-click">${value.email}</div>
                </div>
            </li>`;
            $('#global-search-results').append(result);
        });

        res.orders.forEach((value) => {
            hasResult = true;
            const result = `
            <li class="list-group-item global-result text-center" data-url="/admin/order/view/${value._id}">
                <div class="row">
                    <div class="col global-result-type gr-click"><i class="feather" data-feather="package"></i> Order</div>
                    <div class="col global-result-detail gr-click">${value.orderFirstname} ${value.orderLastname}</div>
                    <div class="col global-result-detail gr-click">${moment(value.orderDate).format('YYYY/MM/DD')}</div>
                    <div class="col global-result-detail gr-click">${value.orderEmail}</div>
                </div>
            </li>`;
            $('#global-search-results').append(result);
        });

        res.products.forEach((value) => {
            hasResult = true;
            const result =
            `<li class="list-group-item global-result text-center" data-url="/admin/product/edit/${value._id}">
                <div class="row">
                    <div class="col global-result-type gr-click"><i class="feather" data-feather="tag"></i> Product</div>
                    <div class="col global-result-detail gr-click">${value.productTitle}</div>
                    <div class="col global-result-detail gr-click">${$('#currencySymbol').val()}${numeral(value.productPrice).format('0.00')}</div>
                </div>
            </li>`;
            $('#global-search-results').append(result);
        });

        if(hasResult === true){
            $('#global-search-results').removeClass('invisible');
        }else{
            const noResult = `<li class="list-group-item text-center">
                <div class="row">
                    <div class="col global-result-type gr-click">Nothing found</div>
                </div>
            </li>`;
            $('#global-search-results').append(noResult);
            $('#global-search-results').removeClass('invisible');
        }

        feather.replace();
    });
}

function validationErrors(errors){
    var errorMessage = '';
    errors.forEach((value) => {
        errorMessage += `<p>${value.dataPath.replace('/', '')} - <span class="text-danger">${value.message}<span></p>`;
    });
    return errorMessage;
}
