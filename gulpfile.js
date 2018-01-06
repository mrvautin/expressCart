const gulp = require('gulp');
const cleanCSS = require('gulp-clean-css');
const minify = require('gulp-minify');
const rename = require('gulp-rename');

gulp.task('compressJS', () => {
    gulp.src(['public/javascripts/*.js', '!public/javascripts/*.min.js'])
        .pipe(minify({
            ext: {
                src: '.js',
                min: '.min.js'
            }
        }))
        .pipe(gulp.dest('public/javascripts'));
});

gulp.task('compressCSS', () => {
    return gulp.src(['public/stylesheets/*.css',
            '!public/stylesheets/*.min.css',
            'public/themes/*.css',
            '!public/themes/*.min.css'
        ])
        .pipe(cleanCSS({compatibility: 'ie8'}))
        .pipe(rename({
            dirname: 'public/stylesheets',
            extname: '.min.css'
        }))
        .pipe(gulp.dest('./'));
});

// run the tasks
gulp.task('deploy', ['compressJS', 'compressCSS']);
