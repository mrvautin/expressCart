import{ serial as test }from'ava';
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
            productQuantity: 1,
            productOptions: {}
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
            productQuantity: 1,
            productOptions: JSON.stringify(g.products[1].productOptions)
        })
        .expect(400);
    t.deepEqual(res.body.message, 'Subscription already existing in cart. You cannot add more.');
});

test('[Fail] Add quantity which exceeds the maxQuantity', async t => {
    const res = await g.request
        .post('/product/addtocart')
        .send({
            productId: g.products[4]._id,
            productQuantity: 75,
            productOptions: {}
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
            productQuantity: 1,
            productOptions: JSON.stringify(g.products[0].productOptions)
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
            productQuantity: 1,
            productOptions: {}
        })
        .expect(400);
    t.deepEqual(res.body.message, 'You cannot combine subscription products with existing in your cart. Empty your cart and try again.');
});

test('[Fail] Add product to cart with not enough stock', async t => {
    const res = await g.request
        .post('/product/addtocart')
        .send({
            productId: g.products[0]._id,
            productQuantity: 20,
            productOptions: JSON.stringify(g.products[0].productOptions)
        })
        .expect(400);
    t.deepEqual(res.body.message, 'There is insufficient stock of this product.');
});

test('[Fail] Add incorrect product to cart', async t => {
    const res = await g.request
        .post('/product/addtocart')
        .send({
            productId: 'fake_product_id',
            productQuantity: 20,
            productOptions: JSON.stringify(g.products[0].productOptions)
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
            productQuantity: 1,
            productOptions: JSON.stringify(g.products[1].productOptions)
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
