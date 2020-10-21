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

test('[Success] Filter reviews', async t => {
    const res = await g.request
        .get('/admin/reviews/filter/terrible')
        .set('apiKey', g.users[0].apiKey)
        .expect(200);

    // Should be one review with this word
    t.deepEqual(res.body.length, 1);
});

test('[Fail] Try add a review with no customer logged in', async t => {
    const review = {
        title: 'This is a new review',
        description: 'This is the description of the new review.',
        rating: 1,
        product: g.products[0]._id
    };

    const res = await g.request
        .post('/product/addreview')
        .send(review)
        .set('apiKey', g.users[0].apiKey)
        .expect(400);

    // Check the returned message
    t.deepEqual(res.body.message, 'You need to be logged in to create a review');
});

test('[Fail] Add a duplicate review', async t => {
    const review = {
        title: 'This is a new review',
        description: 'This is the description of the new review.',
        rating: 1,
        product: g.products[0]._id
    };

    // Login customer first
    await g.request
        .post('/customer/login_action')
        .send({
            loginEmail: g.customers[0].email,
            loginPassword: 'test'
        })
        .expect(200);

    const res = await g.request
        .post('/product/addreview')
        .send(review)
        .set('apiKey', g.users[0].apiKey)
        .expect(400);

    // Check the returned message
    t.deepEqual(res.body.message, 'Review already submitted');
});

test('[Success] Add a review', async t => {
    const review = {
        title: 'This is a new review',
        description: 'This is the description of the new review.',
        rating: 1,
        product: g.products[1]._id
    };

    // Login customer first
    await g.request
        .post('/customer/login_action')
        .send({
            loginEmail: g.customers[0].email,
            loginPassword: 'test'
        })
        .expect(200);

    const res = await g.request
        .post('/product/addreview')
        .send(review)
        .set('apiKey', g.users[0].apiKey)
        .expect(200);

    // Check the returned message
    t.deepEqual(res.body.message, 'Review successfully submitted');
});

test('[Fail] Add a review with missing title', async t => {
    const review = {
        description: 'This is the description of the new review.',
        rating: 1,
        product: g.products[2]._id
    };

    // Login customer first
    await g.request
        .post('/customer/login_action')
        .send({
            loginEmail: g.customers[0].email,
            loginPassword: 'test'
        })
        .expect(200);

    const res = await g.request
        .post('/product/addreview')
        .send(review)
        .set('apiKey', g.users[0].apiKey)
        .expect(400);

    // Check the returned message
    t.deepEqual(res.body.message, 'Please supply a review title');
});

test('[Fail] Add a review with missing description', async t => {
    const review = {
        title: 'This is a new review',
        rating: 1,
        product: g.products[2]._id
    };

    // Login customer first
    await g.request
        .post('/customer/login_action')
        .send({
            loginEmail: g.customers[0].email,
            loginPassword: 'test'
        })
        .expect(200);

    const res = await g.request
        .post('/product/addreview')
        .send(review)
        .set('apiKey', g.users[0].apiKey)
        .expect(400);

    // Check the returned message
    t.deepEqual(res.body.message, 'Please supply a review description');
});

test('[Fail] Add a review with missing rating', async t => {
    const review = {
        title: 'This is a new review',
        description: 'This is the description of the new review.',
        product: g.products[2]._id
    };

    // Login customer first
    await g.request
        .post('/customer/login_action')
        .send({
            loginEmail: g.customers[0].email,
            loginPassword: 'test'
        })
        .expect(200);

    const res = await g.request
        .post('/product/addreview')
        .send(review)
        .set('apiKey', g.users[0].apiKey)
        .expect(400);

    // Check the returned message
    t.deepEqual(res.body.message, 'Please supply a review rating');
});

test('[Fail] Add a review with an invalid rating', async t => {
    const review = {
        title: 'This is a new review',
        description: 'This is the description of the new review.',
        rating: 'test',
        product: g.products[3]._id
    };

    // Login customer first
    await g.request
        .post('/customer/login_action')
        .send({
            loginEmail: g.customers[0].email,
            loginPassword: 'test'
        })
        .expect(200);

    const res = await g.request
        .post('/product/addreview')
        .send(review)
        .set('apiKey', g.users[0].apiKey)
        .expect(400);

    // Check the returned message
    t.deepEqual(res.body.message, 'Please supply a valid rating');
});

test('[Fail] Add a review with a bad word title', async t => {
    const review = {
        title: 'This is a piss',
        description: 'This is the description of the new review.',
        rating: 1,
        product: g.products[3]._id
    };

    // Login customer first
    await g.request
        .post('/customer/login_action')
        .send({
            loginEmail: g.customers[0].email,
            loginPassword: 'test'
        })
        .expect(200);

    const res = await g.request
        .post('/product/addreview')
        .send(review)
        .set('apiKey', g.users[0].apiKey)
        .expect(400);

    // Check the returned message
    t.deepEqual(res.body.message, 'Review was declined. Please check inputs');
});

test('[Fail] Add a review with a bad word description', async t => {
    const review = {
        title: 'This is a review',
        description: 'This is the description of the new piss review.',
        rating: 1,
        product: g.products[3]._id
    };

    // Login customer first
    await g.request
        .post('/customer/login_action')
        .send({
            loginEmail: g.customers[0].email,
            loginPassword: 'test'
        })
        .expect(200);

    const res = await g.request
        .post('/product/addreview')
        .send(review)
        .set('apiKey', g.users[0].apiKey)
        .expect(400);

    // Check the returned message
    t.deepEqual(res.body.message, 'Review was declined. Please check inputs');
});

test('[Fail] Add a review with title too long', async t => {
    const review = {
        title: 'This is a long review title which will exceed the character limit and be stopped cost its not needed.',
        description: 'This is the description of the new review.',
        rating: 1,
        product: g.products[3]._id
    };

    // Login customer first
    await g.request
        .post('/customer/login_action')
        .send({
            loginEmail: g.customers[0].email,
            loginPassword: 'test'
        })
        .expect(200);

    const res = await g.request
        .post('/product/addreview')
        .send(review)
        .set('apiKey', g.users[0].apiKey)
        .expect(400);

    // Check the returned message
    t.deepEqual(res.body.message, 'Review title is too long');
});

test('[Fail] Add a review with description too long', async t => {
    const review = {
        title: 'This is a review title',
        description: `This is the description which is simply too long and people don't need to 
        read about me waffling on about a product. Get the to the point with a clear and short description of 
        why you like the product which will help others decide.`,
        rating: 1,
        product: g.products[3]._id
    };

    // Login customer first
    await g.request
        .post('/customer/login_action')
        .send({
            loginEmail: g.customers[0].email,
            loginPassword: 'test'
        })
        .expect(200);

    const res = await g.request
        .post('/product/addreview')
        .send(review)
        .set('apiKey', g.users[0].apiKey)
        .expect(400);

    // Check the returned message
    t.deepEqual(res.body.message, 'Review description is too long');
});

test('[Success] Delete a review', async t => {
    const res = await g.request
        .post('/admin/review/delete')
        .send({ reviewId: g.reviews[0]._id })
        .set('apiKey', g.users[0].apiKey)
        .expect(200);

    // Check the returned message
    t.deepEqual(res.body.message, 'Successfully deleted review');
});
