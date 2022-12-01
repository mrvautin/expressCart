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

let insertedPageId;

test('[Success] Create a new page', async t => {
    // Login
    await g.request
        .post('/admin/login_action')
        .send({
            email: g.users[0].userEmail,
            password: 'test'
        });
    // Add page
    const res = await g.request
        .post('/admin/settings/page')
        .send({
            pageName: 'This is a page name',
            pageSlug: 'the-page-slug',
            pageEnabled: true,
            pageContent: 'This is the content of the page.'
        });

    // Keep the ID
    insertedPageId = res.body.pageId;
    t.deepEqual(res.body.message, 'New page successfully created');
});

test('[Success] Update a page', async t => {
    // Login
    await g.request
        .post('/admin/login_action')
        .send({
            email: g.users[0].userEmail,
            password: 'test'
        });

    const updatedPage = {
        pageId: insertedPageId,
        pageName: 'This is a new page name',
        pageSlug: 'the-page-slug-has-been-changed',
        pageEnabled: false,
        pageContent: 'This is the new content of the page.'
    };
    // Update page
    const res = await g.request
        .post('/admin/settings/page')
        .send(updatedPage);

    t.deepEqual(res.body.message, 'Page updated successfully');
    t.deepEqual(res.body.pageId, insertedPageId);
    t.deepEqual(res.body.page.pageName, updatedPage.pageName);
    t.deepEqual(res.body.page.pageSlug, updatedPage.pageSlug);
    t.deepEqual(res.body.page.pageEnabled, updatedPage.pageEnabled);
    t.deepEqual(res.body.page.pageContent, updatedPage.pageContent);
});

test('[Success] Delete a page', async t => {
    // Login
    await g.request
        .post('/admin/login_action')
        .send({
            email: g.users[0].userEmail,
            password: 'test'
        });

    // Update page
    const res = await g.request
        .post('/admin/settings/page/delete')
        .send({
            pageId: insertedPageId
        });

    t.deepEqual(res.body.message, 'Page successfully deleted');
});

test('[Fail] Delete an bogus page id', async t => {
    // Login
    await g.request
        .post('/admin/login_action')
        .send({
            email: g.users[0].userEmail,
            password: 'test'
        });

    // Update page
    const res = await g.request
        .post('/admin/settings/page/delete')
        .send({
            pageId: insertedPageId
        });

    t.deepEqual(res.body.message, 'Page not found');
});
