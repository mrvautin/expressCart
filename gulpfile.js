const gulp = require('gulp');
const cleanCSS = require('gulp-clean-css');
const minify = require('gulp-minify');
const rename = require('gulp-rename');

gulp.task('compressJS', () => {
    return gulp.src(['public/javascripts/*.js', '!public/javascripts/*.min.js'])
        .pipe(minify({
            ext: {
                src: '.js',
                min: '.min.js'
            }
        }))
        .pipe(gulp.dest('public/javascripts'));
});

gulp.task('compressCss', () => {
    return gulp.src(['public/stylesheets/*.css',
            '!public/stylesheets/*.min.css'
        ])
        .pipe(cleanCSS({compatibility: 'ie8'}))
        .pipe(rename({
            dirname: 'public/stylesheets',
            extname: '.min.css'
        }))
        .pipe(gulp.dest('./'));
});

gulp.task('compressThemeCss', () => {
    return gulp.src(['views/themes/**/*.css',
            '!views/themes/**/*.min.css'
        ])
        .pipe(cleanCSS({compatibility: 'ie8'}))
        .pipe(rename({
            extname: '.min.css'
        }))
        .pipe(gulp.dest('views/themes/'));
});

// run the tasks
gulp.task('deploy', gulp.series('compressJS', 'compressCss', 'compressThemeCss', (done) => {
    done();
}));
