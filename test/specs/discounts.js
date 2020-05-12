const {
    serial: test
} = require('ava');
const {
    runBefore,
    g
} = require('../helper');
const moment = require('moment');

test.before(async () => {
    await runBefore();
});

test('[Success] Add valid amount discount', async t => {
    // Remove any sessions
    await g.db.sessions.deleteMany({}, {});

    await g.request
        .post('/product/addtocart')
        .send({
            productId: g.products[0]._id,
            productQuantity: 1
        })
        .expect(200);

    const res = await g.request
        .post('/checkout/adddiscountcode')
        .send({
            discountCode: g.discounts[0].code
        })
        .expect(200);

    t.deepEqual(res.body.message, 'Discount code applied');

    // Get our session
    const sessions = await g.db.sessions.find({}).toArray();
    if(!sessions || sessions.length === 0){
        t.fail();
    }

    // Calculate what we expect
    const totalCartAmount = g.products[0].productPrice * 1;

    const session = sessions[0].session;
    t.deepEqual(session.discountCode, g.discounts[0].code);
    t.deepEqual(session.totalCartDiscount, g.discounts[0].value);
    t.deepEqual(session.totalCartAmount, totalCartAmount - g.discounts[0].value);
});

test('[Success] Add valid percent discount', async t => {
    // Remove any sessions
    await g.db.sessions.deleteMany({}, {});

    await g.request
        .post('/product/addtocart')
        .send({
            productId: g.products[0]._id,
            productQuantity: 1
        })
        .expect(200);

    const res = await g.request
        .post('/checkout/adddiscountcode')
        .send({
            discountCode: g.discounts[1].code
        })
        .expect(200);

    t.deepEqual(res.body.message, 'Discount code applied');

    // Get our session
    const sessions = await g.db.sessions.find({}).toArray();
    if(!sessions || sessions.length === 0){
        t.fail();
    }

    // Calculate what we expect - percent
    const totalCartAmount = g.products[0].productPrice * 1;
    const expectedDiscount = (g.discounts[1].value / 100) * totalCartAmount;

    const session = sessions[0].session;
    t.deepEqual(session.discountCode, g.discounts[1].code);
    t.deepEqual(session.totalCartAmount, totalCartAmount - expectedDiscount);
    t.deepEqual(session.totalCartDiscount, expectedDiscount);
});

test('[Fail] Add an expired discount code', async t => {
    await g.request
        .post('/product/addtocart')
        .send({
            productId: g.products[0]._id,
            productQuantity: 1
        })
        .expect(200);

    const res = await g.request
        .post('/checkout/adddiscountcode')
        .send({
            discountCode: g.discounts[2].code
        })
        .expect(400);

    t.deepEqual(res.body.message, 'Discount is expired');
});

test('[Fail] Add a future discount code', async t => {
    await g.request
        .post('/product/addtocart')
        .send({
            productId: g.products[0]._id,
            productQuantity: 1
        })
        .expect(200);

    const res = await g.request
        .post('/checkout/adddiscountcode')
        .send({
            discountCode: g.discounts[3].code
        })
        .expect(400);

    t.deepEqual(res.body.message, 'Discount is expired');
});

test('[Fail] Add a bogus code', async t => {
    await g.request
        .post('/product/addtocart')
        .send({
            productId: g.products[0]._id,
            productQuantity: 1
        })
        .expect(200);

    const res = await g.request
        .post('/checkout/adddiscountcode')
        .send({
            discountCode: 'some_bogus_code'
        })
        .set('csrf-token', g.csrf)
        .expect(400);

    t.deepEqual(res.body.message, 'Discount code is invalid or expired');
});

test('[Success] Create a new discount code', async t => {
    // Add a discount code
    const res = await g.request
        .post('/admin/settings/discount/create')
        .send({
            code: 'TEST_CODE_5',
            type: 'amount',
            value: 10,
            start: moment().add(1, 'days').format('DD/MM/YYYY HH:mm'),
            end: moment().add(7, 'days').format('DD/MM/YYYY HH:mm')
        })
        .set('apiKey', g.users[0].apiKey)
        .set('csrf-token', g.csrf)
        .expect(200);

    t.deepEqual(res.body.message, 'Discount code created successfully');
});

test('[Fail] Create a new discount code with invalid type', async t => {
    // Add a discount code
    const res = await g.request
        .post('/admin/settings/discount/create')
        .send({
            code: 'TEST_CODE_1',
            type: 'bogus_type',
            value: 10,
            start: moment().add(1, 'days').format('DD/MM/YYYY HH:mm'),
            end: moment().add(7, 'days').format('DD/MM/YYYY HH:mm')
        })
        .set('apiKey', g.users[0].apiKey)
        .set('csrf-token', g.csrf)
        .expect(400);

    t.deepEqual(res.body[0].message, 'should be equal to one of the allowed values');
});

test('[Fail] Create a new discount code with existing code', async t => {
    // Add a discount code
    const res = await g.request
        .post('/admin/settings/discount/create')
        .send({
            code: 'valid_10_amount_code',
            type: 'amount',
            value: 10,
            start: moment().add(1, 'days').format('DD/MM/YYYY HH:mm'),
            end: moment().add(7, 'days').format('DD/MM/YYYY HH:mm')
        })
        .set('apiKey', g.users[0].apiKey)
        .set('csrf-token', g.csrf)
        .expect(400);

    t.deepEqual(res.body.message, 'Discount code already exists');
});

test('[Success] Update a discount code', async t => {
    // Add a discount code
    const res = await g.request
        .post('/admin/settings/discount/update')
        .send({
            discountId: g.discounts[0]._id,
            code: 'TEST_CODE_99',
            type: 'amount',
            value: 20,
            start: moment().add(1, 'days').format('DD/MM/YYYY HH:mm'),
            end: moment().add(7, 'days').format('DD/MM/YYYY HH:mm')
        })
        .set('apiKey', g.users[0].apiKey)
        .expect(200);

    t.deepEqual(res.body.discount.value, 20);
    t.deepEqual(res.body.message, 'Successfully saved');
});

test('[Fail] Update a discount with same code as existing', async t => {
    // Add a discount code
    const res = await g.request
        .post('/admin/settings/discount/update')
        .send({
            discountId: g.discounts[1]._id,
            code: 'TEST_CODE_99',
            type: 'amount',
            value: 20,
            start: moment().add(1, 'days').format('DD/MM/YYYY HH:mm'),
            end: moment().add(7, 'days').format('DD/MM/YYYY HH:mm')
        })
        .set('apiKey', g.users[0].apiKey)
        .expect(400);

    t.deepEqual(res.body.message, 'Discount code already exists');
});
