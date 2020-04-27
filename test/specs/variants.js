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
        product: g.products[0]._id
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

test('[Success] Add a variant with null stock', async t => {
    const variant = {
        title: 'test-jacket-variant',
        price: '200.00',
        stock: null,
        product: g.products[0]._id
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

test('[Fail] Add a variant with invalid price', async t => {
    const variant = {
        title: 'test-jacket-variant',
        price: '200',
        stock: null,
        product: g.products[0]._id
    };

    const res = await g.request
        .post('/admin/product/addvariant')
        .send(variant)
        .set('apiKey', g.users[0].apiKey)
        .expect(400);

    // Check the returned message
    t.deepEqual(res.body[0].message, 'Should be a full 2 decimal value. Eg: 10.99');
});

test('[Fail] Add a variant to an invalid product', async t => {
    const variant = {
        title: 'test-jacket-variant',
        price: '200.00',
        stock: 10,
        product: 'invalid-product-id'
    };

    const res = await g.request
        .post('/admin/product/addvariant')
        .send(variant)
        .set('apiKey', g.users[0].apiKey)
        .expect(400);

    // Check the returned message
    t.deepEqual(res.body[0].message, 'should match format "objectid"');
});

test('[Success] Update existing variant', async t => {
    const editVariant = {
        product: g.variants[0].product,
        variant: g.variants[0]._id,
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
    t.deepEqual(res.body.variant._id, editVariant.variant.toString());
    t.deepEqual(res.body.variant.product, editVariant.product.toString());
    t.deepEqual(res.body.variant.title, editVariant.title);
    t.deepEqual(res.body.variant.price, editVariant.price);
    t.deepEqual(res.body.variant.stock, editVariant.stock);
});

test('[Success] Remove existing variant', async t => {
    const res = await g.request
        .post('/admin/product/removevariant')
        .send({
            variant: g.variants[1]._id
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
            variant: 'non-existing-variant-id'
        })
        .set('apiKey', g.users[0].apiKey)
        .expect(400);

    // Check the returned message
    t.deepEqual(res.body.message, 'Failed to remove product variant');
});
