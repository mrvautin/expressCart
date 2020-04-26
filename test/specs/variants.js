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

test('[Success] Add a variant to a product', async t => {
    const variant = {
        title: 'test-jacket-variant',
        price: '200.00',
        stock: 10,
        productId: g.products[0]._id
    };

    const res = await g.request
        .post('/admin/product/addvariant')
        .send(variant)
        .set('apiKey', g.users[0].apiKey)
        .expect(200);

    // Check the returned message
    t.deepEqual(res.body.message, 'Successfully added variant');
    t.deepEqual(res.body.product.variants[0].title, variant.title);
    t.deepEqual(res.body.product.variants[0].price, variant.price);
    t.deepEqual(res.body.product.variants[0].stock, variant.stock);
    t.deepEqual(res.body.product.variants[0].product, g.products[0]._id.toString());
});

test('[Fail] Add a variant to an invalid product', async t => {
    const variant = {
        title: 'test-jacket-variant',
        price: '200.00',
        stock: 10,
        productId: 'invalid-product-id'
    };

    const res = await g.request
        .post('/admin/product/addvariant')
        .send(variant)
        .set('apiKey', g.users[0].apiKey)
        .expect(400);

    // Check the returned message
    t.deepEqual(res.body.message, 'Failed to add product variant');
});

test('[Success] Update existing variant', async t => {
    const editVariant = {
        productId: g.variants[0].product,
        variantId: g.variants[0]._id,
        title: 'edited-title',
        price: '55.55',
        stock: 55
    };

    const res = await g.request
        .post('/admin/product/editvariant')
        .send(editVariant)
        .set('apiKey', g.users[0].apiKey)
        .expect(200);

    // Check the returned message
    t.deepEqual(res.body.message, 'Successfully saved variant');
    t.deepEqual(res.body.variant._id, editVariant.variantId.toString());
    t.deepEqual(res.body.variant.product, editVariant.productId.toString());
    t.deepEqual(res.body.variant.title, editVariant.title);
    t.deepEqual(res.body.variant.price, editVariant.price);
    t.deepEqual(res.body.variant.stock, editVariant.stock);
});

test('[Success] Remove existing variant', async t => {
    const res = await g.request
        .post('/admin/product/removevariant')
        .send({
            variantId: g.variants[1]._id
        })
        .set('apiKey', g.users[0].apiKey)
        .expect(200);

    // Check the returned message
    t.deepEqual(res.body.message, 'Successfully removed variant');
});

test('[Fail] Remove non existing variant', async t => {
    const res = await g.request
        .post('/admin/product/removevariant')
        .send({
            variantId: 'non-existing-variant-id'
        })
        .set('apiKey', g.users[0].apiKey)
        .expect(400);

    // Check the returned message
    t.deepEqual(res.body.message, 'Failed to remove product variant');
});
