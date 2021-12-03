"use Strict";

const Cart = require("../models/Cart");

/**
 * GET /
 * List of carts
 */
exports.index = function (req, res, next) {
  let user = req.user;
  let query = user.isAdmin() ? {} : { _id: user.store };
  let page = req.query.page || req.cookies.page;
  let search = req.query.search || req.cookies.search;

  var opts = {
    page: Math.max(1, parseInt(page || 1)),
    limit: Math.max(10, parseInt(req.query.size || 10)),
    lean: true,
  };

  if (!!search) {
    query["$or"] = [{ region: RegExp("" + search, "i") }];
  }

  Cart.paginate(query, opts, function (err, carts) {
    if (err) return next(err);
    carts.search = search || "";
    carts.isAdmin = user.isAdmin();

    if (carts.page) {
      res.cookie("page", carts.page, { path: "/carts" });
    }

    res.render("carts/index", carts);
  });
};

exports.get = exports.edit = function (req, res, next) {
  // render a form
  var data = {
    action: req.params.new ? "new" : "edit",
    cart: {},
  };

  if (!req.params.id) {
    res.render("carts/edit", data);
  } else {
    Cart.findOne({_id: req.params.id}, function (err, cart) {
      if (err) {
        next(err);
      } else {
        data.cart = cart;
        res.render("carts/edit", data);
      }
    });
  }
};

exports.delete = function (req, res) {
  // delete a cart
  if (!!req.params.id) {
    Cart.findByIdAndRemove(req.params.id, function (err, doc) {
      if (err || !doc) {
        if (err) console.warn(err);
        res.json({
          status: 'ERROR'
        });
      } else {
        res.json({
          status: 'OK'
        });
      }
    });
    return;
  }
  res.json({
    status: 'ERROR'
  });
};

exports.post = function (req, res, next) {
  // create or update a cart
  var data = {
    action: req.params.new ? "new" : "edit",
    cart: {
      region: req.body.region,
      currency: req.body.currency,
      baseURL: req.body.baseURL,
      apiUser: req.body.apiUser,
      apiKey: req.body.apiKey,
      xAuthToken: req.body.xAuthToken,
      emailSendTime: req.body.emailSendTime,
      timeZone: req.body.timeZone
    },
  };

  var cart;

  if (!req.params.id) {
    Cart.create(data.cart, function(err, cart) {
      if (!err) {
        res.redirect('/carts');
      } else {
        next(err);
      }
    });
  } else {
    Cart.findByIdAndUpdate(req.params.id, data.cart, {new : true}, function(err, cart) {
      if (err) {
        next(err);
      } else {
        data.cart = cart;
        data.success = true;
        res.render("carts/edit", data);
      }
    });
  }
};
