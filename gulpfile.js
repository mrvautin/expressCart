const { src, dest, series } = require('gulp');
const gulp = require('gulp');
const less = require('gulp-less');
const cleanCSS = require('gulp-clean-css');
const minify = require('gulp-minify');
const rename = require('gulp-rename');

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
