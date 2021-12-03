var gulp = require('gulp');
var sass = require('gulp-sass');
var babel = require('gulp-babel');
var concat = require('gulp-concat');
//var rename = require('gulp-rename');
var runSequence = require('run-sequence');
var sourcemaps = require('gulp-sourcemaps');
var pipeline = require('readable-stream').pipeline;
var uglify = terser = require('gulp-terser');
var gulpUtil = require('gulp-util');
// var watch = require('gulp-watch');
var del = require('del');

var SRCLIST = [
  'url-search-params-polyfill.js',
  'public/js/lib/mobile-detect.js',
  'public/js/errors.js',
  // libs
  'public/js/lib/vue.js',
  'public/js/lib/jquery-2.2.0.js',
  'public/js/lib/jquery.ajax-retry.js',
  'public/js/lib/jquery.hotkeys.js',
  'public/js/lib/moment.js',
  'public/js/lib/momentjs-business.js',
  'public/js/lib/minivents.js',
  'public/js/lib/bootstrap.js',
  'public/js/lib/bootbox.js',
  'public/js/lib/blob-stream.js',
  'public/js/lib/md5.js',
  'public/js/lib/bootstrap-slider.js',
  'public/js/lib/hammer.js',
  'public/js/lib/jquery.querystring.js',
  'public/js/lib/marchingsquare.js',
  'public/js/lib/ndgmr.collision.js',
  'public/js/lib/simplify.js',
  'public/js/lib/createjs.js',
  'public/js/lib/strftime.js',
  'public/js/lib/upload.js',
  'public/js/lib/select2.js',
  //'public/js/lib/faye.client.js',
  'public/js/lib/pdfkit.js',
  'public/js/lib/bezier.js',
  'public/js/lib/maker.js',
  'public/js/lib/makerjs.exporter.toPDF.js',
  'public/js/lib/jszip.js',
  'public/js/lib/polylabel.js',
  'public/js/lib/bootstrap-datepicker.min.js',
  'public/js/lib/cuid/cuid.js',
  // THE APP
  'build/app/app-main.js',
  // THE EDITOR
  'build/mcb/config/mcb.config.js',
  'build/mcb/utils/mcb.utils.js',
  'build/mcb/utils/mcb.lang.js',
  'build/mcb/utils/mcb.services.js',
  'build/mcb/utils/mcb.history.js',
  'build/mcb/editor/oh/mcb.editor.oh.objecthandles.js',
  'build/mcb/editor/oh/mcb.editor.oh.visuals.js',
  'build/mcb/grid/mcb.grid.js',
  'build/mcb/foam/mcb.foam.js',
  'build/mcb/dxf/mcb.main.dxf.js',
  'build/mcb/tray/mcb.traybuilder.js',
  'build/mcb/editor/shapes/mcb.editor.shapes.rect.js',
  'build/mcb/editor/mcb.editor.shapemanager.js',
  'build/mcb/editor/mcb.editor.selectionmanager.js',
  'build/mcb/editor/oh/mcb.editor.oh.phototracer.js',
  'build/mcb/editor/oh/mcb.editor.oh.selectionrectangle.js',
  'build/mcb/editor/oh/mcb.editor.oh.interpolator.js',
  'build/mcb/editor/oh/mcb.editor.oh.revisions.js',
  'build/mcb/threed/mcb.threed.loader.js',
  //'build/mcb/sockets/mcb.socket.js',
  'build/mcb-editor.js'
  ];


var PREVIEW_SOURCE_LIST = [
  //Vue
  'public/js/lib/vue.js',
  //LIBS
  'public/js/lib/axios.js',
  //APP
  'build/app/app-preview.js',
];


gulp.task('sass', function(){
  return gulp.src('public/css/*.scss', { base: 'public' })
    .pipe(sourcemaps.init())
    .pipe(sass().on('error', sass.logError))
    .pipe(sourcemaps.write('.', {
      sourceMappingURLPrefix: '/css',
      sourceRoot: '/'
    }))
    .pipe(gulp.dest('public'))
});

gulp.task('watch', function(){
  gulp.watch('public/css/*.scss', ['sass']);
  gulp.watch(SRCLIST, ['mainApp']);
  gulp.watch(PREVIEW_SOURCE_LIST, ['previewApp']);
});

gulp.task('mainApp', function() {
  return gulp.src(SRCLIST, { base: 'public' })
    .pipe(sourcemaps.init())
    .pipe(concat('app.js'))
    .pipe(sourcemaps.write('.', {
      sourceMappingURLPrefix: '/dist/js',
      sourceRoot: '/'
    }))
    .pipe(gulp.dest('public/dist/js'));
});

gulp.task('previewApp', function(){
  return gulp.src(PREVIEW_SOURCE_LIST, { base: 'public' })
    .pipe(sourcemaps.init())
    .pipe(concat('app.js'))
    .pipe(sourcemaps.write('.', {
      sourceMappingURLPrefix: '/dist/preview',
      sourceRoot: '/'
    }))
    .pipe(gulp.dest('public/dist/preview'));
});

gulp.task('uglifyMain', function(){
  return pipeline(
    gulp.src('public/dist/js/app.js'),
    uglify(),
    gulp.dest('public/dist/js')
  );
});

gulp.task('uglifyPreview', function(){
  return pipeline(
    gulp.src('public/dist/preview/app.js'),
    uglify(),
    gulp.dest('public/dist/preview')
  );
});

gulp.task('deleteSourceMaps', function() {
  return del([
    'public/dist/js/app.js.map',
    'public/dist/preview/app.js.map'
  ]);
});

gulp.task('production', function(done) {
  runSequence(
    ['mainApp', 'previewApp', 'sass'],
    ['uglifyMain', 'uglifyPreview', 'deleteSourceMaps'],
    done);
});

gulp.task('default', function(done) {
  runSequence(
    ['mainApp', 'previewApp'], // parallel
    'sass', // sequential
    done);
});
