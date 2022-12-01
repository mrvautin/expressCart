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

test('[Success] Get orders', async t => {
    const res = await g.request
        .get('/admin/orders')
        .set('apiKey', g.users[0].apiKey)
        .expect(200);

    // Check the returned order length
    t.deepEqual(g.jsonData.orders.length, res.body.orders.data.length);
});

test('[Fail] Try get orders with a bogus apiKey', async t => {
    const res = await g.request
        .get('/admin/orders')
        .set('apiKey', '123456789012345678901234')
        .expect(400);

    t.deepEqual(res.body.message, 'Access denied');
});

test('[Success] Get orders by <Paid> status', async t => {
    const res = await g.request
        .get('/admin/orders/bystatus/Paid')
        .set('apiKey', g.users[0].apiKey)
        .expect(200);

    // Check the returned order length
    t.deepEqual(1, res.body.orders.length);
});
