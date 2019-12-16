import{ serial as test }from'ava';

test('[Success] Run test data', async t => {
    const spawnSync = require('child_process').spawnSync;
    let exitCode;
    try{
        exitCode = spawnSync('npm', ['run', 'testdata'], {
            shell: true
        });
    }catch(error){
        console.log('Error', error);
    }
    t.deepEqual(exitCode.status, 0);
});
