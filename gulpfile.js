const { src, dest, series, watch } = require('gulp');
const gulp = require('gulp');
const nodemon = require('gulp-nodemon');
const less = require('gulp-less');
const colors = require('colors');
const cleanCSS = require('gulp-clean-css');
const minify = require('gulp-minify');
const rename = require('gulp-rename');

const nodemonOptions = {
    script: 'app.js',
    ext: 'js json',
    env: { NODE_ENV: 'development' },
    verbose: false,
    ignore: [],
    watch: ['lib/*', 'config/*', 'routes/*', 'app.js']
};

function lessCss(){
    return gulp.src('public/stylesheets/less/**/*.less')
        .pipe(less({
            paths: [
                'public/stylesheets/less'
            ]
        }))
        .pipe(rename({
            dirname: 'public/stylesheets',
            extname: '.css'
        }))
        .pipe(gulp.dest('./'));
};

function compressJS(){
    return src([
        'public/javascripts/*.js',
        '!public/javascripts/*.min.js'
    ])
    .pipe(minify({
        ext: {
            src: '.js',
            min: '.min.js'
        }
    }))
    .pipe(dest('public/javascripts'));
};

function compressCss(){
    return src([
        'public/stylesheets/*.css',
        '!public/stylesheets/*.min.css'
    ])
    .pipe(cleanCSS({ compatibility: 'ie8' }))
    .pipe(rename({
        dirname: 'public/stylesheets',
        extname: '.min.css'
    }))
    .pipe(dest('./'));
};

function compressThemeCss(){
    return src([
        'views/themes/**/*.css',
        '!views/themes/**/*.min.css'
    ])
    .pipe(cleanCSS({ compatibility: 'ie8' }))
    .pipe(rename({
        extname: '.min.css'
    }))
    .pipe(dest('views/themes/'));
};

function compressThemeJS(){
    return src([
        'views/themes/**/*.js',
        '!views/themes/**/*.min.js'
    ])
    .pipe(minify({
        ext: {
            src: '.js',
            min: '.min.js'
        }
    }))
    .pipe(dest('views/themes/'));
};

// run the tasks
gulp.task('default', series(lessCss, compressJS, compressCss, compressThemeCss, compressThemeJS));

gulp.task('watch', (done) => {
    // Watch LESS files and generate CSS
    watch(['public/stylesheets/less/**/*.less'], async () => {
        lessCss();
        console.log(colors.blue('CSS generation complete'));
    });

    // run, watch and restart app
    nodemon(nodemonOptions)
    .once('quit', () => {
        done();
    });
});
