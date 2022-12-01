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

test('[Success] Create API key', async t => {
    // Login
    await g.request
        .post('/admin/login_action')
        .send({
            email: g.users[0].userEmail,
            password: 'test'
        });
    const res = await g.request
        .post('/admin/createApiKey')
        .expect(200);

    g.users[0].apiKey = res.body.apiKey;
    t.deepEqual(res.body.message, 'API Key generated');
    t.deepEqual(res.body.apiKey.length, 24);
});

test('[Success] User Login', async t => {
    const res = await g.request
        .post('/admin/login_action')
        .send({
            email: g.users[0].userEmail,
            password: 'test'
        })
        .expect(200);
    t.deepEqual(res.body.message, 'Login successful');
});

test('[Fail] Incorrect user password', async t => {
    const res = await g.request
        .post('/admin/login_action')
        .send({
            email: g.users[0].userEmail,
            password: 'test1'
        })
        .expect(400);
    t.deepEqual(res.body.message, 'Access denied. Check password and try again.');
});

test('[Fail] Delete own user account', async t => {
    const res = await g.request
        .post('/admin/user/delete')
        .send({
            userId: g.users[0]._id
        })
        .expect(400);
    t.deepEqual(res.body.message, 'Unable to delete own user account');
});

test('[Fail] Delete invalid user ID', async t => {
    const res = await g.request
        .post('/admin/user/delete')
        .send({
            userId: 'invalid_user_id'
        })
        .expect(400);
    t.deepEqual(res.body.message, 'User not found.');
});

test('[Success] Create new user', async t => {
    const user = {
        usersName: 'Jim Smith',
        userEmail: 'jim.smith@gmail.com',
        userPassword: 'test',
        isAdmin: false
    };
    const res = await g.request
        .post('/admin/user/insert')
        .send(user)
        .set('apiKey', g.users[0].apiKey)
        .expect(200);
    t.deepEqual(res.body.message, 'User account inserted');
});

test('[Fail] Create new user with invalid email', async t => {
    const user = {
        usersName: 'Jim Smith',
        userEmail: 'jim.smith@gmail',
        userPassword: 'test',
        isAdmin: false
    };
    const res = await g.request
        .post('/admin/user/insert')
        .send(user)
        .set('apiKey', g.users[0].apiKey)
        .expect(400);
    t.deepEqual(res.body.message, 'Failed to create user. Check inputs.');
    t.deepEqual(res.body.error[0].message, 'should match format "emailAddress"');
});

test('[Success] Update user', async t => {
    const user = {
        userId: g.users[1]._id,
        usersName: 'Jim Smith',
        userEmail: 'jim.smith@gmail.com',
        userPassword: 'test',
        isAdmin: false
    };
    const res = await g.request
        .post('/admin/user/update')
        .send(user)
        .set('apiKey', g.users[0].apiKey)
        .expect(200);
    t.deepEqual(res.body.user._id, g.users[1]._id.toString());
    t.deepEqual(res.body.user.usersName, 'Jim Smith');
    t.deepEqual(res.body.user.userEmail, 'jim.smith@gmail.com');
    t.deepEqual(res.body.message, 'User account updated');
});

test('[Fail] Update user invalid email', async t => {
    const user = {
        userId: g.users[1]._id,
        usersName: 'Jim Smith',
        userEmail: 'jim.smith@gmail',
        userPassword: 'test',
        isAdmin: false
    };
    const res = await g.request
        .post('/admin/user/update')
        .send(user)
        .set('apiKey', g.users[0].apiKey)
        .expect(400);
    t.deepEqual(res.body.message, 'Failed to create user. Check inputs.');
    t.deepEqual(res.body.error[0].message, 'should match format "emailAddress"');
});

test('[Fail] Update user invalid userId', async t => {
    const user = {
        userId: '5dcfc8a5492532d1943e259e',
        usersName: 'Jim Smith',
        userEmail: 'jim.smith@gmail',
        userPassword: 'test',
        isAdmin: false
    };
    const res = await g.request
        .post('/admin/user/update')
        .send(user)
        .set('apiKey', g.users[0].apiKey)
        .expect(400);
    t.deepEqual(res.body.message, 'User not found');
});
