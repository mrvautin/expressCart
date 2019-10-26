const { src, dest, series } = require('gulp');
const gulp = require('gulp');
const cleanCSS = require('gulp-clean-css');
const minify = require('gulp-minify');
const rename = require('gulp-rename');

function compressJS(){
    return src(['public/javascripts/*.js', '!public/javascripts/*.min.js'])
        .pipe(minify({
            ext: {
                src: '.js',
                min: '.min.js'
            }
        }))
        .pipe(dest('public/javascripts'));
};

function compressCss(){
    return src(['public/stylesheets/*.css',
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
    return src(['views/themes/**/*.css',
            '!views/themes/**/*.min.css'
        ])
        .pipe(cleanCSS({ compatibility: 'ie8' }))
        .pipe(rename({
            extname: '.min.css'
        }))
        .pipe(dest('views/themes/'));
};

// run the tasks
gulp.task('default', series(compressJS, compressCss, compressThemeCss));
