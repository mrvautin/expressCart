const {
    serial: test
} = require('ava');
const {
    runBefore,
    g
} = require('../helper');

test.before(async () => {
    await runBefore();
});

test('[Success] Add subscripton product to cart', async t => {
    const res = await g.request
        .post('/product/addtocart')
        .send({
            productId: g.products[7]._id,
            productQuantity: 1
        })
        .expect(200);
    const sessions = await g.db.cart.find({}).toArray();
    if(!sessions || sessions.length === 0){
        t.fail();
    }
    t.deepEqual(res.body.message, 'Cart successfully updated');
});

test('[Fail] Add product to cart when subscription already added', async t => {
    const res = await g.request
        .post('/product/addtocart')
        .send({
            productId: g.products[1]._id,
            productQuantity: 1
        })
        .expect(400);
    t.deepEqual(res.body.message, 'Subscription already existing in cart. You cannot add more.');
});

test('[Fail] Add quantity which exceeds the maxQuantity', async t => {
    const res = await g.request
        .post('/product/addtocart')
        .send({
            productId: g.products[4]._id,
            productQuantity: 75
        })
        .expect(400);
    t.deepEqual(res.body.message, 'The quantity exceeds the max amount. Please contact us for larger orders.');
});

test('[Success] Empty cart', async t => {
    const res = await g.request
        .post('/product/emptycart')
        .expect(200);
    t.deepEqual(res.body.message, 'Cart successfully emptied');
});

test('[Success] Add product to cart', async t => {
    const res = await g.request
        .post('/product/addtocart')
        .send({
            productId: g.products[0]._id,
            productQuantity: 1
        })
        .expect(200);
    const sessions = await g.db.cart.find({}).toArray();
    if(!sessions || sessions.length === 0){
        t.fail();
    }
    t.deepEqual(res.body.message, 'Cart successfully updated');
});

test('[Success] Update cart', async t => {
    const cart = await g.request
        .get('/cart/retrieve')
        .expect(200);

    const cartId = Object.keys(cart.body.cart)[0];
    const productId = cart.body.cart[cartId].productId;

    const res = await g.request
        .post('/product/updatecart')
        .send({
            productId: productId,
            cartId: cartId,
            quantity: 10
        })
        .expect(200);

    t.deepEqual(res.body.message, 'Cart successfully updated');

    const checkCart = await g.request
        .get('/cart/retrieve')
        .expect(200);

    // Check new quantity and total price has been updated
    t.deepEqual(checkCart.body.cart[cartId].quantity, 10);
    t.deepEqual(checkCart.body.cart[cartId].totalItemPrice, cart.body.cart[cartId].totalItemPrice * 10);
});

test('[Fail] Cannot add subscripton when other product in cart', async t => {
    const res = await g.request
        .post('/product/addtocart')
        .send({
            productId: g.products[7]._id,
            productQuantity: 1
        })
        .expect(400);
    t.deepEqual(res.body.message, 'You cannot combine subscription products with existing in your cart. Empty your cart and try again.');
});

test('[Fail] Add product to cart with not enough stock', async t => {
    const res = await g.request
        .post('/product/addtocart')
        .send({
            productId: g.products[0]._id,
            productQuantity: 20
        })
        .expect(400);
    t.deepEqual(res.body.message, 'There is insufficient stock of this product.');
});

test('[Fail] Add incorrect product to cart', async t => {
    const res = await g.request
        .post('/product/addtocart')
        .send({
            productId: 'fake_product_id',
            productQuantity: 20
        })
        .expect(400);
    t.deepEqual(res.body.message, 'Error updating cart. Please try again.');
});

test('[Success] Remove item previously added to cart', async t => {
    // Add a second product to cart
    const cart = await g.request
        .post('/product/addtocart')
        .send({
            productId: g.products[1]._id,
            productQuantity: 1
        })
        .expect(200);

    const res = await g.request
        .post('/product/removefromcart')
        .send({
            cartId: cart.body.cartId
        })
        .expect(200);
    t.deepEqual(res.body.message, 'Product successfully removed');
});

test('[Fail] Try remove an item which is not in the cart', async t => {
    const res = await g.request
        .post('/product/removefromcart')
        .send({
            cartId: 'bogus_product_id'
        })
        .expect(400);
    t.deepEqual(res.body.message, 'Product not found in cart');
});

test('[Fail] Try add more than the variant stock', async t => {
    const variant = {
        title: 'test-jacket-variant',
        price: '200.00',
        stock: 10,
        product: g.products[0]._id
    };

    // Add a new variant
    const res = await g.request
        .post('/admin/product/addvariant')
        .send(variant)
        .set('apiKey', g.users[0].apiKey)
        .expect(200);

    // Stock the variant ID
    const newVariantId = res.body.product.variants[0]._id;

    // Empty our cart
    const emptyCart = await g.request
        .post('/product/emptycart')
        .expect(200);
    t.deepEqual(emptyCart.body.message, 'Cart successfully emptied');

    // Add more than we have in stock
    const addToCart = await g.request
        .post('/product/addtocart')
        .send({
            productId: g.products[0]._id,
            productVariant: newVariantId,
            productQuantity: 15
        })
        .expect(400);

    t.deepEqual(addToCart.body.message, 'There is insufficient stock of this product.');
});

test('[Fail] Try hold stock then add more stock than available', async t => {
    const variant = {
        title: 'test-jacket-variant',
        price: '200.00',
        stock: 10,
        product: g.products[0]._id
    };

    // Add a new variant
    const res = await g.request
        .post('/admin/product/addvariant')
        .send(variant)
        .set('apiKey', g.users[0].apiKey)
        .expect(200);

    // Stock the variant ID
    const newVariantId = res.body.product.variants[0]._id;

    // Empty our cart
    const emptyCart = await g.request
        .post('/product/emptycart')
        .expect(200);
    t.deepEqual(emptyCart.body.message, 'Cart successfully emptied');

    // Add lesser amount than stock on hand
    await g.request
        .post('/product/addtocart')
        .send({
            productId: g.products[0]._id,
            productVariant: newVariantId,
            productQuantity: 5
        })
        .expect(200);

    // Add more stock than is available considering held stock
    const addToCart2 = await g.request
        .post('/product/addtocart')
        .send({
            productId: g.products[0]._id,
            productVariant: newVariantId,
            productQuantity: 8
        })
        .expect(400);

    t.deepEqual(addToCart2.body.message, 'There is insufficient stock of this product.');
});

test('[Success] Hold some stock add more stock which is less than total', async t => {
    const variant = {
        title: 'test-jacket-variant',
        price: '200.00',
        stock: 10,
        product: g.products[0]._id
    };

    // Add a new variant
    const res = await g.request
        .post('/admin/product/addvariant')
        .send(variant)
        .set('apiKey', g.users[0].apiKey)
        .expect(200);

    // Stock the variant ID
    const newVariantId = res.body.product.variants[0]._id;

    // Empty our cart
    const emptyCart = await g.request
        .post('/product/emptycart')
        .expect(200);
    t.deepEqual(emptyCart.body.message, 'Cart successfully emptied');

    // Add lesser amount than stock on hand
    await g.request
        .post('/product/addtocart')
        .send({
            productId: g.products[0]._id,
            productVariant: newVariantId,
            productQuantity: 5
        })
        .expect(200);

    // Add more stock than is available considering held stock
    const addToCart2 = await g.request
        .post('/product/addtocart')
        .send({
            productId: g.products[0]._id,
            productVariant: newVariantId,
            productQuantity: 5
        })
        .expect(200);

    t.deepEqual(addToCart2.body.message, 'Cart successfully updated');
});
