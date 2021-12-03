/**
 * Module dependencies.
 */
var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var url = require('url');

var express = require('express');
var cookieParser = require('cookie-parser');
var compress = require('compression');
var favicon = require('serve-favicon');
var session = require('express-session');
var bodyParser = require('body-parser');
var logger = require('morgan');
var errorHandler = require('errorhandler');
errorHandler.title = 'MyCaseBuilder';
var lusca = require('lusca');
var methodOverride = require('method-override');
var dotenv = require('dotenv');
var MongoStore = require('connect-mongo/es5')(session);
var flash = require('express-flash');
var mongoose = require('mongoose');
mongoose.Promise = global.Promise;

if (process.env.MONGOOSE_DEBUG) mongoose.set('debug', true);

var passport = require('passport');
var expressValidator = require('express-validator');
var multer = require('multer');

var stringHelper = require('./helpers/strings');

/**
 * Load environment variables from .env file, where API keys and passwords are configured.
 *
 * Default path: .env (You can remove the path argument entirely, after renaming `.env.example` to `.env`)
 */
dotenv.load({ path: '.env' });

/**
 *  Initialize and setup rollbar.
 *  https://docs.rollbar.com/docs/nodejs#section-log-messages
 *
 *  use rollbar global where admin notification is required
 *  rollbar.error("Emergency notice!");
 *
 */
var Rollbar = require('rollbar');
var rollbar = global.rollbar = new Rollbar({
  accessToken: process.env.ROLLBAR_ACCESS_TOKEN,
  transmit: process.env.NODE_ENV !== "development",
  environment: process.env.NODE_ENV,
  captureUnhandledRejections: true,
  captureUncaught: true,
  context: "server",
  verbose: true,
});

/**
 * Controllers (route handlers).
 */
var homeController = require("./controllers/home");
var previewController = require("./controllers/preview");
var ordersController = require("./controllers/orders");
var userController = require("./controllers/user");
var designerController = require("./controllers/designer");
var caseController = require("./controllers/case");
var cartController = require("./controllers/cart");
var caseCategoryController = require("./controllers/caseCategory");
var publicDesignController = require("./controllers/publicDesigns");
var storeController = require("./controllers/store");
var shapeLibraryController = require("./controllers/shapeLibrary");
var variantController = require("./controllers/variant");
var apiController = require("./controllers/api");
var contactController = require("./controllers/contact");
var revisionController = require("./controllers/revision");

/**
 * API keys and Passport configuration.
 */
var passportConf = require('./config/passport');

/**
 * Create Express server.
 */
var app = express();
app.locals.appEnv = process.env.NODE_ENV;
app.locals.rollbarAccessToken = process.env.ROLLBAR_ACCESS_TOKEN;

/**
 * Connect to MongoDB.
 */
mongoose.connect(process.env.MONGODB || process.env.MONGOLAB_URI, { autoReconnect: true, useMongoClient: true });
mongoose.connection.on('error', function(err) {
  console.log('MongoDB Connection Error. Please make sure that MongoDB is running.');
  rollbar.error(err, function () {
    process.exit(1);
  });
});

var GridFsStorage = require('multer-gridfs-storage');
var GridFsStorageFile = require('./lib/gridfs-storage-file.js');
var upload = multer({ storage: new GridFsStorage({ db: mongoose.connection, cache: true, file: GridFsStorageFile }), limts: { files: 4 } });

var MongoDB = require('mongodb');
var serveGridfs = require('serve-gridfs').default; // contrary to the documentation, this module requires mongodb-native 2.x
var mongoConnection = MongoDB.MongoClient.connect(process.env.MONGODB || process.env.MONGOLAB_URI);

// fall-throught replacement for express.static @ public/uploads/{filename}
app.use("/uploads", serveGridfs(mongoConnection, { byId: false }));
app.use("//uploads", serveGridfs(mongoConnection, { byId: false }));

//var crc32 = require('crc-32');
//var gitHead = require('git-head');
try {
  var stats = fs.statSync('./public/dist/js/app.js');
  app.locals.releaseVersion = (new Date(stats.birthtime)).getTime();
  console.log('Initializing client build version: ' + app.locals.releaseVersion);
} catch (err) {
  console.warn('Client build missing!!!');
  console.error(err);
  process.exit(1);
}

/**
 * Express configuration.
 */
console.log(process.env.NODE_ENV);
if (['staging','production'].includes(process.env.NODE_ENV)) {
  app.set('trust proxy', true);
}

app.use(function (req, res, next) {
  req.href = url.format({
    host: req.get('host'),
    protocol: req.protocol,
    hostname: req.hostname,
    pathname: req.originalUrl,
    searchParams: req.query
  });
  next();
});

app.use(express.static(__dirname + '/public'));
app.use(compress());
app.use(bodyParser.json({limit: '64mb'}));

// check at some point the below to see if we acutly use this. its in form -- native form submit
app.use(bodyParser.urlencoded({limit: '64mb', extended: true, parameterLimit:1000}));

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(logger('dev'));
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(expressValidator());
app.use(methodOverride());
app.use(cookieParser());

var expSession = session({
  resave: true,
  saveUninitialized: true,
  secret: process.env.SESSION_SECRET,
  store: new MongoStore({
    url: process.env.MONGODB || process.env.MONGOLAB_URI,
    autoReconnect: true
  })
});
app.use(expSession);

app.use(expressValidator({
    customValidators: {
      isPopulatedArray: function (value) {
        // is it an array and does array have legit stuff in it.
        return Array.isArray(value) && value.filter(Boolean).length;
    }
 }
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

// skip CSRF token for these urls
app.use(function (req, res, next) {
  var paths = [
    {regex: /^\/api\/account\/app-settings(?:\/(?=$))?$/i,
      method: 'POST'},
    {regex: /^\/api\/account\/default-checkout-options(?:\/(?=$))?$/i,
      method: 'POST'},
    {regex: /^\/stores\/([^\\/]+?)\/parts\/([^\\/]+?)(?:\/(?=$))?$/i,
      method: 'DELETE' },
    {regex: /^\/stores\/([^\\/]+?)\/parts\/([^\\/]+?)(?:\/(?=$))?$/i,
      method: 'PUT' },
    {regex: /^\/stores\/([^\\/]+?)\/options\/([^\\/]+?)(?:\/(?=$))?$/i,
      method: 'DELETE'},
    {regex: /^\/options\/([^\\/]+?)\/variants\/new(?:\/(?=$))?$/i,
      method: 'POST'},
    {regex: /^\/variants\/([^\\/]+?)(?:\/(?=$))?$/i,
      method: 'DELETE'},
    {regex: /^\/variants\/([^\\/]+?)(?:\/(?=$))?$/i,
      method: 'PUT'},
    {regex: /^\/api\/auth\/login(?:\/(?=$))?$/i,
      method: 'POST'},
    {regex: /^\/api\/auth\/register(?:\/(?=$))?$/i,
      method: 'POST'},
    {regex: /^\/api\/auth\/forgot(?:\/(?=$))?$/i,
      method: 'POST'},
    {regex: /^\/api\/auth\/logout(?:\/(?=$))?$/i,
      method: 'POST'},
    {regex: /^\/api\/designs\/new(?:\/(?=$))?$/i,
      method: 'POST'},
    {regex: /^\/api\/designs\/([^\\/]+?)(?:\/(?=$))?$/i,
      method: 'PUT'},
    {regex: /^\/api\/designs\/([^\\\/]+?)(?:\/(?=$))?$/i,
      method: 'DELETE'},
    {regex: /^\/api\/designs\/([^\\\/]+)\/revisions\/([^\\\/]+)$/i,
      method: 'DELETE'},
    {regex: /^\/api\/designs\/updateAdminPdfDataAndOrPublicDesignData\/([^\\/]+?)(?:\/(?=$))?$/i,
      method: 'PUT'},
    {regex: /^\/api\/designs\/snapshot\/([^\\/]+?)(?:\/(?=$))?$/i,
      method: 'POST'},
    {regex: /^\/api\/designs\/snapshot\/([^\\/]+?)(?:\/(?=$))?$/i,
      method: 'PUT'},
    {regex: /^\/api\/shape-categories\/new(?:\/(?=$))?$/i,
      method: 'POST'},
    {regex: /^\/api\/shape-brands\/new(?:\/(?=$))?$/i,
      method: 'POST'},
    {regex: /^\/api\/shapes\/new(?:\/(?=$))?$/i,
      method: 'POST'},
    {regex: /^\/api\/shapes\/images\/new(?:\/(?=$))?$/i,
      method: 'POST'},
    {regex: /^\/api\/shapes(?:\/(?=$))?$/i,
      method: 'GET'},
    {regex: /^\/api\/shapes\/([^\\/]+?)(?:\/(?=$))?$/i,
      method: 'DELETE'},
    {regex: /^\/api\/cases\/([^\\/]+?)\/in-case-shapes(?:\/(?=$))?$/i,
      method: 'POST'},
    {regex: /^\/api\/cases\/([^\\/]+?)\/in-case-shapes(?:\/(?=$))?$/i,
      method: 'DELETE'},
    {regex: /^\/api\/cases\/([^\\\/]+?)(?:\/(?=$))?$/i,
      method: 'POST'},
    {regex: /^\/api\/shapes\/([^\\\/]+?)(?:\/(?=$))?$/i,
      method: 'PUT'},
    {regex: /^\/api\/shapes\/([^\\\/]+?)\/shared(?:\/(?=$))?$/i,
      method: 'PUT'},
    {regex: /^\/api\/shape-brands\/([^\\\/]+?)(?:\/(?=$))?$/i,
      method: 'PUT'},
    {regex: /^\/api\/shape-categories\/([^\\\/]+?)(?:\/(?=$))?$/i,
      method: 'PUT'},
    {regex: /^\/api\/shape-categories\/([^\\\/]+?)\/shape-brands\/([^\\\/]+?)(?:\/(?=$))?$/i,
      method: 'DELETE'},
    {regex: /^\/api\/users\/([^\\\/]+?)\/designs(?:\/(?=$))?$/i,
      method: 'GET'},
    {regex: /^\/api\/users\/cart(?:\/(?=$))?$/i,
      method: 'GET'},
    {regex: /^\/api\/users\/cart(?:\/(?=$))?$/i,
      method: 'POST'},
    {regex: /^\/api\/users\/cart(?:\/(?=$))?$/i,
      method: 'DELETE'},
    {regex: /^\/api\/users\/cart\/snapshots(?:\/(?=$))?$/i,
      method: 'GET'},
    {regex: /^\/api\/users\/profile$/i,
      method: 'POST'},
    {regex: /^\/api\/users\/password/i,
      method: 'POST'},
    {regex: /^\/api\/case\/cscartcategories(?:\/(?=$))?$/i,
      method: 'GET'},
    {regex: /^\/api\/case\/categories(?:\/(?=$))?$/i,
      method: 'GET'},
    {regex: /^\/api\/designs\/([^\\\/]+?)\/lock(?:\/(?=$))?$/i,
      method: 'PUT'},
    {regex: /^\/api\/designs\/([^\\\/]+?)\/lock(?:\/(?=$))?$/i,
      method: 'GET'},
    {regex: /^\/api\/designs\/([^\\\/]+?)\/soft-lock(?:\/(?=$))?$/i,
      method: 'PUT'},
    {regex: /^\/api\/designs\/soft-lock-multiple(?:\/(?=$))?$/i,
      method: 'PUT'},
    {regex: /^\/api\/designs\/lock-multiple(?:\/(?=$))?$/i,
      method: 'PUT'},
    {regex: /^\/api\/designs\/([^\\\/]+?)\/clone(?:\/(?=$))?$/i,
      method: 'POST'},
    {regex: /^\/api\/designs\/([^\\\/]+?)\/template\/clone(?:\/(?=$))?$/i,
      method: 'POST'},
    {regex: /^\/api\/order\/product-data\/([^\\\/]+?)\/([^\\\/]+?)\/([^\\\/]+?)(?:\/(?=$))?$/i,
      method: 'GET'},
    {regex: /^\/api\/order\/store-checkout-data\/([^\\\/]+?)(?:\/(?=$))?$/i,
      method: 'GET'},
    {regex: /^\/api\/order\/email(?:\/(?=$))?$/i,
      method: 'POST'},
    {regex: /\/preview(\/.+)*/ ,
      method: 'GET'},
    {regex: /\/api\/preview(\/.+)*/ ,
      method: 'GET'},
    {regex: /^\/api\/publicdesigns\/design/,
      method: 'POST'},
    {regex: /^\/api\/external\/publicdesigns\/candidate/,
      method: 'POST'},
    {regex: /^\/api\/publicdesigns\/candidate/,
      method: 'POST'},
    {regex: /^\/api\/users\/cart\/clear(?:\/(?=$))?$/i,
      method: 'POST'}
  ];

  var absPaths = [
    '/api/upload'
  ];

  var regexMatch = paths.some(function (pattern) {
    return req.method === pattern.method && pattern.regex.test(req.path);
  });

  var absPathMatch = paths.some(function (path) {
    return req.path === path;
  });

  if (regexMatch) {
    console.log('regexMatch', regexMatch);
    return next();
  }

  if (absPathMatch) {
    console.log('absPathMatch', absPathMatch);
    return next();
  }

  lusca.csrf()(req, res, next);
});

app.use(lusca.xframe('SAMEORIGIN'));
app.use(lusca.xssProtection(true));

app.use(function (req, res, next) {
  res.locals.user = req.user;
  next();
});

app.use(function (req, res, next) {
  if (/api/i.test(req.path)) {
    req.session.returnTo = req.path;
  }
  next();
});

app.locals.stringHelper = stringHelper;

// Preview Routes
app.get('/preview/:id',
  previewController.index
);

app.get('/api/preview/:id',
  designerController.getRevisionByMongoID
);


/**
 * Primary app routes.
 */
app.get('/',
  homeController.index
);

app.get('/login',
  userController.getLogin
);

app.post('/login',
  userController.postLogin
);

app.get('/logout',
  userController.logout
);

app.get('/forgot',
  userController.getForgot
);

app.post('/forgot',
  userController.postForgot
);

app.get('/reset/:token',
  userController.getReset
);

app.post('/reset/:token',
  userController.postReset
);

app.get('/signup',
  userController.getSignup
);

app.post('/signup',
  userController.postSignup
);

app.get(
  '/app',
  designerController.getNew
);

app.get(
  '/app/orders',
  passportConf.isAuthenticated,
  ordersController.getNew
);

app.get(
  '/lang',
  designerController.getLang
);

app.get(
  '/cases/search',
  caseController.search
);

app.get(
  '/cases/suggest',
  caseController.suggest
);

app.get('/contact',
  contactController.getContact
);

app.post('/contact',
  contactController.postContact
);

app.get('/account',
  passportConf.isAuthenticated,
  userController.getAccount
);

app.post('/account/profile',
  passportConf.isAuthenticated,
  userController.postUpdateProfile
);

app.post('/account/password',
  passportConf.isAuthenticated,
  userController.postUpdatePassword
);

app.post('/account/delete',
  passportConf.isAuthenticated,
  userController.postDeleteAccount
);

app.get('/account/unlink/:provider',
  passportConf.isAuthenticated,
  userController.getOauthUnlink
);

/**
 * App JSON API routes.
 */
app.post('/api/auth/login',
  userController.postLoginJSON
);

app.post('/api/auth/logout',
  userController.postLogoutJSON
);

app.post('/api/auth/register',
  userController.postRegisterJSON
);

app.post('/api/auth/forgot',
  userController.postForgotJSON
);

app.post('/api/account/app-settings',
  passportConf.isAuthenticated,
  userController.postUpdateUserAppSettings
);

app.post('/api/account/default-checkout-options',
  passportConf.isAuthenticated,
  userController.postUpdateUserDefaultCheckoutOptions
);

app.post('/api/designs/new',
  designerController.postDesignJSON
);

app.post('/api/designs/:id/clone',
  designerController.postDesignCloneJSON
);

app.post('/api/designs/:id/template/clone',
  passportConf.isAuthenticated,
  passportConf.isAtLeastExporter,
  designerController.postDesignCloneTemplateJSON
);

app.get('/api/designs',
  designerController.getIndexJSON
);

app.get('/api/designs/search',
  designerController.searchDesignJSON
);

app.get('/api/users/:email/designs/',
  passportConf.isAuthenticated,
  passportConf.isAtLeastRep,
  designerController.getUserDesignsJSON
);

app.get('/api/users/cart',
  userController.getCartItems
);

app.post('/api/users/cart',
  passportConf.isAuthenticated,
  userController.storeCartItems
);

app.delete('/api/users/cart',
  passportConf.isAuthenticated,
  userController.removeCartItem
);

app.post('/api/users/cart/clear',
  passportConf.requireXAuthToken,
  userController.clearCartItemsExternally
);

app.get('/api/users/cart/snapshots',
  passportConf.isAuthenticated,
  userController.getCartItemSnapshotsAndLayers
);

app.get('/api/users/order-history',
  passportConf.isAuthenticated,
  userController.getCartOrderHistory
);

app.post('/api/users/profile',
  passportConf.isAuthenticated,
  userController.postUpdateProfile
);

app.get('/api/users/order-history-pagination/:limit/:search/:page',
  passportConf.isAuthenticated,
  userController.getCartOrderHistoryPagination
);

app.post('/api/users/password',
  passportConf.isAuthenticated,
  userController.postUpdatePassword
);

app.put('/api/designs/adminpdf',
  passportConf.isAuthenticated,
  designerController.putUpdateAdminPdfData
);
app.put('/api/designs/updateAdminPdfDataAndOrPublicDesignData',
  passportConf.isAtLeastAdmin,
  designerController.putUpdateAdminPdfDataAndOrPublicDesignData
);
app.post('/api/designs/snapshot/:id',
  designerController.postDesignSnapshotJSON
);

app.put('/api/designs/snapshot/:id',
  designerController.putDesignSnapshotJSON
);

app.put('/api/designs/:id/lock',
  designerController.putDesignLockJSON
);

app.get('/api/designs/:id/lock',
  designerController.getDesignLockJSON
);

app.put('/api/designs/:id/soft-lock',
  designerController.putDesignSoftLockJSON
);

app.put('/api/designs/soft-lock-multiple',
  designerController.putDesignSoftLockMultipleJSON
);

app.put('/api/designs/lock-multiple',
  designerController.putDesignLockMultipleJSON
);

app.get('/api/designs/revisions/:fileId',
  designerController.getRevisionsByFileId
);

app.post('/api/cases/:id/in-case-shapes',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAdmin,
  caseController.postInCaseShapeJSON
);

app.delete('/api/cases/:id/in-case-shapes',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAdmin,
  caseController.deleteInCaseShapeJSON
);

app.post('/api/cases/:id/',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAdmin,
  caseController.postEditJSON
);

app.get('/api/designs/:id',
  passportConf.isAuthenticated,
  passportConf.isAtLeastExporterReturn403,
  designerController.getDesignJSON
);

app.delete('/api/designs/:id',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAdmin,
  designerController.deleteDesignJSON
);

app.delete('/api/designs/:design_id/revisions/:revision_id',
  passportConf.isAuthenticated,
  designerController.deleteDesignRevisionJSON
);

app.put('/api/designs/:id',
  designerController.putDesignUpdateJSON
);

app.get('/api/order/product-data/:mcbid/:storeId/:lang',
  caseController.getProductDataJSON
);

app.get('/api/order/productlist-data/:mcbid/:storeId/:lang',
  caseController.getProductListDataJSON
);

app.get('/api/order/store-checkout-data/:storeId',
  storeController.getStoreCheckoutData
);

app.post('/api/order/email',
  userController.emailAdmin
);

app.get('/api/shapes',
  shapeLibraryController.searchForShapeJSON
);

app.put('/api/shapes/:id',
  passportConf.isAuthenticated,
  shapeLibraryController.updateShapeJSON
);

app.delete('/api/shapes/:id',passportConf.isAuthenticated,
  shapeLibraryController.deletePrivateShapeJSON
);

app.put('/api/shapes/:id/shared',
  passportConf.isAuthenticated,
  shapeLibraryController.updateShapeSharedUsersJSON
);

app.post('/api/shapes/new',
  passportConf.isAuthenticated,
  shapeLibraryController.postNewShapeJSON
);

app.post('/api/shapes/images/new',
  passportConf.isAuthenticated,
  passportConf.isAtLeastLibrarian,
  upload.single('shape-photo'),
  shapeLibraryController.postNewShapeImage
);

app.get('/api/shape-categories/',
  shapeLibraryController.getShapeCategoriesJSON
);

app.post('/api/shape-categories/new',
  passportConf.isAuthenticated,
  passportConf.isAtLeastLibrarian,
  shapeLibraryController.postNewShapeCategoryJSON
);

app.put('/api/shape-categories/:id',
  passportConf.isAuthenticated,
  passportConf.isAtLeastLibrarian,
  shapeLibraryController.putShapeCategoryJSON
);

app.delete('/api/shape-categories/:categoryId/shape-brands/:brandId',
  passportConf.isAuthenticated,
  passportConf.isAtLeastLibrarian,
  shapeLibraryController.deleteBrandFromCategoryJSON
);

app.get('/api/shape-brands/',
  shapeLibraryController.getShapeBrandsJSON
);

app.post('/api/shape-brands/new',
  passportConf.isAuthenticated,
  passportConf.isAtLeastLibrarian,
  shapeLibraryController.postNewShapeBrandJSON
);

app.put('/api/shape-brands/:id',
  passportConf.isAuthenticated,
  passportConf.isAtLeastLibrarian,
  shapeLibraryController.putShapeBrandJSON
);

app.post('/api/publicdesigns/design',
  passportConf.isAuthenticated,
  upload.array('files', 4),
  publicDesignController.create
);

app.post('/api/publicdesigns/candidate',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAdmin,
  publicDesignController.updateCandidateStatus
);

app.post('/api/external/publicdesigns/candidate',
  passportConf.requireXAuthToken,
  publicDesignController.updateCandidateStatusExternal
);

app.get('/api/case/cscartcategories',
  passportConf.isAuthenticated,
  caseCategoryController.csCartCategories
);

app.get('/api/case/casecategories',
  passportConf.isAuthenticated,
  caseCategoryController.caseCategories
);

/**
 * Admin routes.
 */
app.get('/users',
  passportConf.isAuthenticated,
  passportConf.isAtLeastRep,
  userController.index
);

app.get('/users/:email',
  passportConf.isAuthenticated,
  passportConf.isAtLeastRep,
  userController.getEdit
);

app.get('/users/edit/:email',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAdmin,
  userController.getEdit
);

app.post('/users/edit/:email',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAdmin,
  userController.postEdit
);

app.get(
  '/shapes',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAdmin,
  shapeLibraryController.index
);

app.get(
  '/cases',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAdmin,
  caseController.index
);

app.get(
  '/cases/new',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAdmin,
  caseController.getNew
);

app.post(
  '/cases/new',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAdmin,
  caseController.postNew
);

app.post(
  '/cases/categories/new',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAdmin,
  caseCategoryController.postNew
);

app.get(
  '/cases/edit/:mcbid',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAdmin,
  caseController.getEdit
);

app.post(
  '/cases/edit/:mcbid',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAdmin,
  caseController.postEdit
);

app.get(
  '/cases/all-product-codes',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAdmin,
  caseController.getAllProductCodes
);

app.put(
  '/cases/all-product-codes',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAdmin,
  caseController.setAllProductCodes
);

app.get(
  '/cases/:mcbid/get-product-features',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAdmin,
  caseController.getProductFeaturesJSON
);

app.get(
  '/cases/:mcbid/get-product-codes',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAdmin,
  caseController.getProductCodes
);

app.get(
  '/stores',
  passportConf.isAuthenticated,
  passportConf.isAtLeastRep,
  storeController.index
);

app.get(
  '/stores/new',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAdmin,
  storeController.getNew
);

app.post(
  '/stores/new',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAdmin,
  storeController.postNew
);

app.get(
  '/stores/edit/:id',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAdmin,
  storeController.getEdit
);

app.post(
  '/stores/edit/:id',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAdmin,
  storeController.postEdit
);

app.post(
  '/stores/edit/:id/copy-cases',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAdmin,
  storeController.postCopyCases
);

app.get(
  '/stores/:id/parts',
  passportConf.isAuthenticated,
  passportConf.isAtLeastRep,
  storeController.getPartsIndex
);

app.get(
  '/prices/:id',
  passportConf.isAuthenticated,
  passportConf.isAtLeastRep,
  storeController.getPartsIndex
);

app.delete(
  '/stores/:id',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAdmin,
  storeController.delete
);

app.delete(
  '/stores/:id/parts/:priceId',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAffiliate,
  storeController.deletePart
);

app.put(
  '/stores/:id/parts/:priceId',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAffiliate,
  storeController.updatePrice
);

app.post(
  '/stores/:id/parts/:partId',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAffiliate,
  storeController.addPart
);

app.get(
  '/stores/:id/options/:optionId',
  passportConf.isAuthenticated,
  passportConf.isAtLeastRep,
  storeController.getOptions
);

app.delete(
  '/stores/:id/options/:optionId',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAffiliate,
  storeController.deleteOptions
);

app.post(
  '/stores/:id/prices/:priceId/options/new',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAffiliate,
  storeController.newOptions
);

app.get(
  '/carts',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAdmin,
  cartController.index
);

app.get(
  '/carts/:new',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAdmin,
  cartController.edit
);

app.post(
  '/carts/:new',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAdmin,
  cartController.post
);

app.get(
  '/carts/:id/edit',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAdmin,
  cartController.edit
);

app.post(
  '/carts/:id/edit',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAdmin,
  cartController.post
);

app.delete(
  '/carts/:id',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAdmin,
  cartController.delete
);

app.post(
  '/options/:id/variants/new',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAffiliate,
  storeController.newVariants
);

app.put('/variants/:id',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAffiliate,
  variantController.editVariant
);

app.delete('/variants/:id',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAffiliate,
  variantController.deleteVariant
);

app.get('/designs',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAffiliate,
  revisionController.index
);

app.get('/designs/:id',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAdmin,
  revisionController.getDesign
);

app.post('/designs/:id',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAdmin,
  revisionController.postDesign
);

app.get('/designs/:id/transfer',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAdmin,
  revisionController.getTransfer
);

app.post('/designs/:id/transfer',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAdmin,
  revisionController.postTransfer
);

app.post('/export/designs',
  passportConf.isAuthenticated,
  passportConf.isAtLeastAdmin,
  revisionController.postExport
);


/**
 * API auth routes.
 */
app.get('/api/stripe',
  apiController.getStripe
);

app.post('/api/stripe',
  apiController.postStripe
);

app.get('/api/upload',
  apiController.getFileUpload
);

app.post('/api/upload',
  upload.single('myFile'),
  apiController.postFileUpload
);

app.get('/auth/facebook',
  passport.authenticate('facebook', {
    scope: ['email', 'user_location']
  })
);

app.get('/auth/facebook/callback',
  passport.authenticate('facebook', {
    failureRedirect: '/login'
  }),
  function(req, res) {
    res.redirect(req.session.returnTo || '/');
  }
);

app.get('/auth/google',
  passport.authenticate('google', {
    scope: 'profile email'
  })
);

app.get('/auth/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/login'
  }),
  function(req, res) {
    res.redirect(req.session.returnTo || '/');
  }
);

app.get('/auth/twitter',
  passport.authenticate('twitter')
);

app.get('/auth/twitter/callback',
  passport.authenticate('twitter', {
    failureRedirect: '/login'
  }),
  function(req, res) {
    res.redirect(req.session.returnTo || '/');
  }
);

/*
 *  Fall-through catch-all
 *  If we get here - nothing else handled us so trigger the errorhandler middleware w/ a 404.
 *  (ALWAYS place at the 2nd to last middleware)
 */
app.use(function (req, res, next) {
  if (['HEAD','GET'].includes(req.method)) {
    res.statusCode = 404;
    next(new Error("Not found - " + req.path));
  } else {
    res.statusCode = 405;
    next(new Error("Method Not Allowed"));
  }
});

const quietErrorHandler = errorHandler({ log: false });
const defaultErrorHandler = errorHandler({ log: false });
/**
 * Error Handling.
 */
app.use(function (err, req, res, next) {
  let status = res.statusCode || 500;

  let error = new Error();
  error.name = err.name;
  error.stack = err.stack;
  error.message = err.message;
  error.constructor = err.constructor;
  error.__proto__ = err.__proto__;
  // fully cloned error

  if (res.statusCode < 400) {
    status = 500;
  }
  if (err.statusCode) {
    status = err.statusCode;
  }
  if (err.status) {
    status = err.status;
  }

  // strip stack on production instances
  if (process.env.NODE_ENV !== 'development') {
    error.stack = null;
  }

  if (req.xhr) {
    // force errorHandler to spit out JSON
    req.headers.accept = "application/json";
  }

  // only log fatal errors.
  if (status > 499) {
    // rollbar reporting
    if (err instanceof Error) {
      rollbar.error(err, req);
    } else {
      rollbar.error('Error: ' + err, req);
    }

    // response already sent
    if (res._header) return;

    // respond in kind and log it to the console
    defaultErrorHandler(error, req, res, next);
  } else {
    // response already sent
    if (res._header) return;

    // respond in kind but don't log it to the console
    quietErrorHandler(error, req, res, next);
  }
});

// /**
//  * Start Express server.
//  */
// app.listen(app.get('port'), function() {
//   console.log('Express server listening on port %d in %s mode', app.get('port'), app.get('env'));
// });

module.exports = app;
