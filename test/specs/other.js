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

test('[Success] Check for sitemap.xml', async t => {
    const res = await g.request
        .get('/sitemap.xml')
        .expect(200);

    if(!res.text){
        t.fail();
    }

    // Document should start with XML tag
    t.deepEqual(res.text.substring(0, 5), '<?xml');
});
