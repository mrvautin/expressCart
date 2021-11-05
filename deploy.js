const { minify } = require('uglify-es');
const cleanCss = require('clean-css');
const globby = require('globby');
const colors = require('colors');
const { render } = require('less');
const fs = require('fs');
const path = require('path');

const compressJS = async () => {
    const publicFiles = globby.sync([
        'public/javascripts/*.js',
        '!public/javascripts/*.min.js'
    ], { nosort: true });

    // Public JS
    for (const file of publicFiles) {
        const minified = await minify(fs.readFileSync(file, 'utf-8'));
        const parseFilePath = path.parse(file);
        fs.writeFileSync(`${parseFilePath.dir}/${parseFilePath.name}.min.js`, minified.code);
    }

    const themeFiles = globby.sync([
        'views/themes/**/*.js',
        '!views/themes/**/*.min.js'
    ], { nosort: true });

    // Theme JS
    for (const file of themeFiles) {
        const minified = await minify(fs.readFileSync(file, 'utf-8'));
        const parseFilePath = path.parse(file);
        fs.writeFileSync(`${parseFilePath.dir}/${parseFilePath.name}.min.js`, minified.code);
    }
};

const compressCss = async () => {
    const publicOutputPath = path.join('public', 'stylesheets');
    const themeOutputPath = path.join('views', 'themes');
    const publicFiles = globby.sync([
        'public/stylesheets/less/*.less'
    ], { nosort: true });

    for (const file of publicFiles) {
        const parseFilePath = path.parse(file);
        // Process the less
        const less = await render(fs.readFileSync(file, 'utf-8'), {});

        // Write less style
        fs.writeFileSync(`${publicOutputPath}/${parseFilePath.name}.css`, less.css);

        // Minify css
        const minified = await new cleanCss({}).minify(less.css).styles;

        // Write minified css
        fs.writeFileSync(`${publicOutputPath}/${parseFilePath.name}.min.css`, minified);
    }

    const themeFiles = globby.sync([
        'views/themes/*.less'
    ], { nosort: true });
    for (const file of themeFiles) {
        const parseFilePath = path.parse(file);
        // Process the less
        const less = await render(fs.readFileSync(file, 'utf-8'), {});

        // Write less style
        fs.writeFileSync(`${themeOutputPath}/${parseFilePath.name}.css`, less.css);

        // Minify css
        const minified = await new cleanCss({}).minify(less.css).styles;

        // Write minified css
        fs.writeFileSync(`${themeOutputPath}/${parseFilePath.name}.min.css`, minified);
    }
};

const run = async () => {
    await compressJS();
    console.log("JS compressed");
    await compressCss();
    console.log("CSS compressed")
};

// Run the deploy tasks
run()
    .then(() => {
    console.log(colors.green('Complete!'));
})
    .catch(e => {
    console.error(e);
});
