const spawnSync = require('child_process').spawnSync;
const {
    serial: test
} = require('ava');

test('[Success] Run test data', async t => {
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
