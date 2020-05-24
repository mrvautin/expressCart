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

test('[Success] Create a customer', async t => {
    const customer = {
        email: 'sarah.jones@test.com',
        company: 'Acme Co',
        firstName: 'Sarah',
        lastName: 'Jones',
        address1: '1 Sydney Street',
        address2: '',
        country: 'Australia',
        state: 'NSW',
        postcode: '2000',
        phone: '0400000000',
        password: 'password'
    };

    const res = await g.request
        .post('/customer/create')
        .send(customer)
        .expect(200);

    t.deepEqual(res.body.email, customer.email);
    t.deepEqual(res.body.firstName, customer.firstName);
});

test('[Fail] Try create a duplicate customer', async t => {
    const customer = {
        email: 'sarah.jones@test.com',
        company: 'Acme Co',
        firstName: 'Sarah',
        lastName: 'Jones',
        address1: '1 Sydney Street',
        address2: '',
        country: 'Australia',
        state: 'NSW',
        postcode: '2000',
        phone: '0400000000',
        password: 'password'
    };

    const res = await g.request
        .post('/customer/create')
        .send(customer)
        .expect(400);

    t.deepEqual(res.body.message, 'A customer already exists with that email address');
});

test('[Fail] Create with invalid email address', async t => {
    const customer = {
        email: 'sarah.jones@test',
        company: 'Acme Co',
        firstName: 'Sarah',
        lastName: 'Jones',
        address1: '1 Sydney Street',
        address2: '',
        country: 'Australia',
        state: 'NSW',
        postcode: '2000',
        phone: '0400000000',
        password: 'password'
    };

    const res = await g.request
        .post('/customer/create')
        .send(customer)
        .expect(400);

    t.deepEqual(res.body[0].message, 'should match format "emailAddress"');
});

test('[Success] Update existing customer from dashboard', async t => {
    const customer = {
        customerId: g.customers[1]._id,
        company: 'Acme Co',
        email: 'sarah.jones@test.com',
        firstName: 'Sarah',
        lastName: 'Jones',
        address1: '1 Sydney Street',
        address2: '',
        country: 'Australia',
        state: 'NSW',
        postcode: '2000',
        phone: '0444444444'
    };

    const res = await g.request
        .post('/admin/customer/update')
        .send(customer)
        .set('apiKey', g.users[0].apiKey)
        .expect(200);

    t.deepEqual(res.body.message, 'Customer updated');
    t.deepEqual(res.body.customer.company, customer.company);
    t.deepEqual(res.body.customer.email, customer.email);
    t.deepEqual(res.body.customer.firstName, customer.firstName);
    t.deepEqual(res.body.customer.lastName, customer.lastName);
    t.deepEqual(res.body.customer.address1, customer.address1);
    t.deepEqual(res.body.customer.country, customer.country);
    t.deepEqual(res.body.customer.state, customer.state);
    t.deepEqual(res.body.customer.postcode, customer.postcode);
    t.deepEqual(res.body.customer.phone, customer.phone);
});

test('[Success] Update existing customer from customer page', async t => {
    const customer = {
        customerId: g.customers[1]._id,
        company: 'Acme Company',
        email: 'sarah.jones@test.com',
        firstName: 'Tina',
        lastName: 'Smith',
        address1: '2 Sydney Street',
        address2: '',
        country: 'Australia',
        state: 'NSW',
        postcode: '2000',
        phone: '0444444444'
    };

    await g.request
        .post('/customer/login_action')
        .send({
            loginEmail: 'sarah.jones@test.com',
            loginPassword: 'test'
        })
        .expect(200);

    const res = await g.request
        .post('/customer/update')
        .send(customer)
        .expect(200);

    t.deepEqual(res.body.message, 'Customer updated');
    t.deepEqual(res.body.customer.company, customer.company);
    t.deepEqual(res.body.customer.email, customer.email);
    t.deepEqual(res.body.customer.firstName, customer.firstName);
    t.deepEqual(res.body.customer.lastName, customer.lastName);
    t.deepEqual(res.body.customer.address1, customer.address1);
    t.deepEqual(res.body.customer.country, customer.country);
    t.deepEqual(res.body.customer.state, customer.state);
    t.deepEqual(res.body.customer.postcode, customer.postcode);
    t.deepEqual(res.body.customer.phone, customer.phone);
});

test('[Success] Get customer list', async t => {
    const res = await g.request
        .get('/admin/customers')
        .set('apiKey', g.users[0].apiKey)
        .expect(200);

    // Check the returned customers length
    t.deepEqual(3, res.body.length);
});

test('[Success] Filter customers', async t => {
    const res = await g.request
        .get('/admin/customers/filter/Testy')
        .set('apiKey', g.users[0].apiKey)
        .expect(200);

    // Check the returned customers length
    t.deepEqual(1, res.body.customers.length);
});

test('[Success] Get single customer', async t => {
    const res = await g.request
        .get(`/admin/customer/view/${g.customers[0]._id}`)
        .set('apiKey', g.users[0].apiKey)
        .expect(200);

    // Check the returned customer matches ID
    t.deepEqual(g.customers[0]._id.toString(), res.body._id);
});

test('[Fail] Customer login with incorrect email', async t => {
    const res = await g.request
        .post('/customer/login_action')
        .send({
            loginEmail: 'test1111@test.com',
            loginPassword: 'test'
        })
        .expect(400);
    t.deepEqual(res.body.message, 'A customer with that email does not exist.');
});

test('[Success] Customer login with correct email', async t => {
    const res = await g.request
        .post('/customer/login_action')
        .send({
            loginEmail: g.customers[0].email,
            loginPassword: 'test'
        })
        .expect(200);
    t.deepEqual(res.body.message, 'Successfully logged in');
});

test('[Success] Delete a customer', async t => {
    const res = await g.request
        .delete('/admin/customer')
        .send({
            customerId: g.customers[0]._id
        })
        .set('apiKey', g.users[0].apiKey)
        .expect(200);
    t.deepEqual(res.body.message, 'Customer deleted');
});

test('[Success] Failed deleting an incorrect customer', async t => {
    const res = await g.request
        .delete('/admin/customer')
        .send({
            customerId: g.customers[0]._id
        })
        .set('apiKey', g.users[0].apiKey)
        .expect(400);
    t.deepEqual(res.body.message, 'Failed to delete customer. Customer not found');
});
