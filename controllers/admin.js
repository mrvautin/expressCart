const escape = require("html-entities").AllHtmlEntities;
const colors = require("colors");
const bcrypt = require("bcryptjs");
const moment = require("moment");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const mime = require("mime-type/with-db");
const csrf = require("csurf");
const util = require("util");
const stream = require("stream");
const { validateJson } = require("../lib/schema");
const {
  clearSessionValue,
  mongoSanitize,
  getThemes,
  getId,
  allowedMimeType,
  fileSizeLimit,
  checkDirectorySync,
  sendEmail,
} = require("../lib/common");
const { getConfig, updateConfig } = require("../lib/config");
const {
  sortMenu,
  getMenu,
  newMenu,
  updateMenu,
  deleteMenu,
  orderMenu,
} = require("../lib/menu");
const ObjectId = require("mongodb").ObjectID;
const csrfProtection = csrf({ cookie: true });

// Regex
const emailRegex = /\S+@\S+\.\S+/;
const numericRegex = /^\d*\.?\d*$/;

/**
 * Controller for GET request to '/admin'
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
exports.getAdminController = (req, res, next) => {
  res.redirect("/admin/dashboard");
};

/**
 * Controller for GET request to '/admin/logout'
 * @param {*} req
 * @param {*} res
 */
exports.getAdminLogoutController = (req, res) => {
  req.session.user = null;
  req.session.message = null;
  req.session.messageType = null;
  res.redirect("/");
};

/**
 * Controller for GET request to '/admin/csrf'
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
exports.getCSRFController = (req, res, next) => {
  res.json({
    csrf: req.csrfToken(),
  });
};

/**
 * Controller for GET request to '/admin/login'
 * @param {*} req
 * @param {*} res
 */
exports.getAdminLoginController = async (req, res) => {
  const db = req.app.db;

  const userCount = await db.users.countDocuments({});
  // we check for a user. If one exists, redirect to login form otherwise setup
  if (userCount && userCount > 0) {
    // set needsSetup to false as a user exists
    req.session.needsSetup = false;
    res.render("login", {
      title: "Login",
      referringUrl: req.header("Referer"),
      config: req.app.config,
      message: clearSessionValue(req.session, "message"),
      messageType: clearSessionValue(req.session, "messageType"),
      helpers: req.handlebars.helpers,
      showFooter: "showFooter",
    });
  } else {
    // if there are no users set the "needsSetup" session
    req.session.needsSetup = true;
    res.redirect("/admin/setup");
  }
};

/**
 * Controller for POST request to '/admin/login_action'
 * @param {*} req
 * @param {*} res
 */
exports.postAdminLoginController = async (req, res) => {
  const db = req.app.db;

  const user = await db.users.findOne({
    userEmail: mongoSanitize(req.body.email),
  });
  if (!user || user === null) {
    res.status(400).json({ message: "A user with that email does not exist." });
    return;
  }

  // we have a user under that email so we compare the password
  bcrypt.compare(req.body.password, user.userPassword).then((result) => {
    if (result) {
      req.session.user = req.body.email;
      req.session.usersName = user.usersName;
      req.session.userId = user._id.toString();
      req.session.isAdmin = user.isAdmin;
      res.status(200).json({ message: "Login successful" });
      return;
    }
    // password is not correct
    res
      .status(400)
      .json({ message: "Access denied. Check password and try again." });
  });
};

/**
 * Controller for GET request to '/admin/setup'
 * @param {*} req
 * @param {*} res
 */
exports.getAdminSetupController = async (req, res) => {
  const db = req.app.db;

  const userCount = await db.users.countDocuments({});
  // dont allow the user to "re-setup" if a user exists.
  // set needsSetup to false as a user exists
  req.session.needsSetup = false;
  if (userCount === 0) {
    req.session.needsSetup = true;
    res.render("setup", {
      title: "Setup",
      config: req.app.config,
      helpers: req.handlebars.helpers,
      message: clearSessionValue(req.session, "message"),
      messageType: clearSessionValue(req.session, "messageType"),
      showFooter: "showFooter",
    });
    return;
  }
  res.redirect("/admin/login");
};

/**
 * Controller for POST request to '/admin/setup_action'
 * @param {*} req
 * @param {*} res
 */
exports.postAdminSetupController = async (req, res) => {
  const db = req.app.db;

  const doc = {
    usersName: req.body.usersName,
    userEmail: req.body.userEmail,
    userPassword: bcrypt.hashSync(req.body.userPassword, 10),
    isAdmin: true,
    isOwner: true,
  };

  // check for users
  const userCount = await db.users.countDocuments({});
  if (userCount === 0) {
    // email is ok to be used.
    try {
      await db.users.insertOne(doc);
      res.status(200).json({ message: "User account inserted" });
      return;
    } catch (ex) {
      console.error(colors.red(`Failed to insert user: ${ex}`));
      res.status(200).json({ message: "Setup failed" });
      return;
    }
  }
  res.status(200).json({ message: "Already setup." });
};

/**
 * Controller for GET request to '/admin/dashboard'
 * @param {*} req
 * @param {*} res
 */
exports.getAdminDashboardController = async (req, res) => {
  const db = req.app.db;

  // Collate data for dashboard
  const dashboardData = {
    productsCount: await db.products.countDocuments({
      productPublished: true,
    }),
    ordersCount: await db.orders.countDocuments({}),
    ordersAmount: await db.orders
      .aggregate([
        { $match: {} },
        { $group: { _id: null, sum: { $sum: "$orderTotal" } } },
      ])
      .toArray(),
    productsSold: await db.orders
      .aggregate([
        { $match: {} },
        { $group: { _id: null, sum: { $sum: "$orderProductCount" } } },
      ])
      .toArray(),
    topProducts: await db.orders
      .aggregate([
        { $project: { _id: 0 } },
        { $project: { o: { $objectToArray: "$orderProducts" } } },
        { $unwind: "$o" },
        {
          $group: {
            _id: "$o.v.title",
            productImage: { $last: "$o.v.productImage" },
            count: { $sum: "$o.v.quantity" },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ])
      .toArray(),
  };

  // Fix aggregate data
  if (dashboardData.ordersAmount.length > 0) {
    dashboardData.ordersAmount = dashboardData.ordersAmount[0].sum;
  }
  if (dashboardData.productsSold.length > 0) {
    dashboardData.productsSold = dashboardData.productsSold[0].sum;
  } else {
    dashboardData.productsSold = 0;
  }

  res.render("dashboard", {
    title: "Cart dashboard",
    session: req.session,
    admin: true,
    dashboardData,
    themes: getThemes(),
    message: clearSessionValue(req.session, "message"),
    messageType: clearSessionValue(req.session, "messageType"),
    helpers: req.handlebars.helpers,
    config: req.app.config,
    csrfToken: req.csrfToken(),
  });
};

/**
 * Controller for GET request to '/admin/settings'
 * @param {*} req
 * @param {*} res
 */
exports.getAdminSettingsController = (req, res) => {
  res.render("settings", {
    title: "Cart settings",
    session: req.session,
    admin: true,
    themes: getThemes(),
    message: clearSessionValue(req.session, "message"),
    messageType: clearSessionValue(req.session, "messageType"),
    helpers: req.handlebars.helpers,
    config: req.app.config,
    footerHtml:
      typeof req.app.config.footerHtml !== "undefined"
        ? escape.decode(req.app.config.footerHtml)
        : null,
    googleAnalytics:
      typeof req.app.config.googleAnalytics !== "undefined"
        ? escape.decode(req.app.config.googleAnalytics)
        : null,
    csrfToken: req.csrfToken(),
  });
};

/**
 * Controller for POST request to '/admin/createApiKey'
 * @param {*} req
 * @param {*} res
 */
exports.postAdminCreateAPIKeyController = async (req, res) => {
  const db = req.app.db;
  const result = await db.users.findOneAndUpdate(
    {
      _id: ObjectId(req.session.userId),
      isAdmin: true,
    },
    {
      $set: {
        apiKey: new ObjectId(),
      },
    },
    {
      returnOriginal: false,
    }
  );

  if (result.value && result.value.apiKey) {
    res
      .status(200)
      .json({ message: "API Key generated", apiKey: result.value.apiKey });
    return;
  }
  res.status(400).json({ message: "Failed to generate API Key" });
};

/**
 * Controller for POST request to '/admin/settings/update'
 * @param {*} req
 * @param {*} res
 */
exports.postAdminSettingsUpdateController = (req, res) => {
  const result = updateConfig(req.body);
  if (result === true) {
    req.app.config = getConfig();
    res.status(200).json({ message: "Settings successfully updated" });
    return;
  }
  res.status(400).json({ message: "Permission denied" });
};

/**
 * Controller for GET request to '/admin/settings/menu'
 * @param {*} req
 * @param {*} res
 */
exports.getAdminSettingsMenuController = async (req, res) => {
  const db = req.app.db;
  res.render("settings-menu", {
    title: "Cart menu",
    session: req.session,
    admin: true,
    message: clearSessionValue(req.session, "message"),
    messageType: clearSessionValue(req.session, "messageType"),
    helpers: req.handlebars.helpers,
    config: req.app.config,
    menu: sortMenu(await getMenu(db)),
    csrfToken: req.csrfToken(),
  });
};

/**
 * Controller for GET request to '/admin/settings/pages'
 * @param {*} req
 * @param {*} res
 */
exports.getAdminSettingsPagesController = async (req, res) => {
  const db = req.app.db;
  const pages = await db.pages.find({}).toArray();

  res.render("settings-pages", {
    title: "Static pages",
    pages: pages,
    session: req.session,
    admin: true,
    message: clearSessionValue(req.session, "message"),
    messageType: clearSessionValue(req.session, "messageType"),
    helpers: req.handlebars.helpers,
    config: req.app.config,
    menu: sortMenu(await getMenu(db)),
    csrfToken: req.csrfToken(),
  });
};

/**
 * Controller for GET request to '/admin/settings/pages/new'
 * @param {*} req
 * @param {*} res
 */
exports.getAdminSettingsPagesNewController = async (req, res) => {
  const db = req.app.db;

  res.render("settings-page", {
    title: "Static pages",
    session: req.session,
    admin: true,
    button_text: "Create",
    message: clearSessionValue(req.session, "message"),
    messageType: clearSessionValue(req.session, "messageType"),
    helpers: req.handlebars.helpers,
    config: req.app.config,
    menu: sortMenu(await getMenu(db)),
    csrfToken: req.csrfToken(),
  });
};

/**
 * Controller for get request to '/admin/settings/pages/edit/:page'
 * @param {*} req
 * @param {*} res
 */
exports.getAdminSettingsPagesEditController = async (req, res) => {
  const db = req.app.db;
  const page = await db.pages.findOne({ _id: getId(req.params.page) });
  const menu = sortMenu(await getMenu(db));
  if (!page) {
    res.status(404).render("error", {
      title: "404 Error - Page not found",
      config: req.app.config,
      message: "404 Error - Page not found",
      helpers: req.handlebars.helpers,
      showFooter: "showFooter",
      menu,
    });
    return;
  }

  res.render("settings-page", {
    title: "Static pages",
    page: page,
    button_text: "Update",
    session: req.session,
    admin: true,
    message: clearSessionValue(req.session, "message"),
    messageType: clearSessionValue(req.session, "messageType"),
    helpers: req.handlebars.helpers,
    config: req.app.config,
    menu,
    csrfToken: req.csrfToken(),
  });
};

/**
 * Controller for POST request to '/admin/settings/page'
 * @param {*} req
 * @param {*} res
 */
exports.getAdminSettingsPageInsertOrUpdateController = async (req, res) => {
  const db = req.app.db;

  const doc = {
    pageName: req.body.pageName,
    pageSlug: req.body.pageSlug,
    pageEnabled: req.body.pageEnabled,
    pageContent: req.body.pageContent,
  };

  if (req.body.pageId) {
    // existing page
    const page = await db.pages.findOne({ _id: getId(req.body.pageId) });
    if (!page) {
      res.status(400).json({ message: "Page not found" });
      return;
    }

    try {
      const updatedPage = await db.pages.findOneAndUpdate(
        { _id: getId(req.body.pageId) },
        { $set: doc },
        { returnOriginal: false }
      );
      res.status(200).json({
        message: "Page updated successfully",
        pageId: req.body.pageId,
        page: updatedPage.value,
      });
    } catch (ex) {
      res
        .status(400)
        .json({ message: "Error updating page. Please try again." });
    }
  } else {
    // insert page
    try {
      const newDoc = await db.pages.insertOne(doc);
      res.status(200).json({
        message: "New page successfully created",
        pageId: newDoc.insertedId,
      });
      return;
    } catch (ex) {
      res
        .status(400)
        .json({ message: "Error creating page. Please try again." });
    }
  }
};

/**
 * Controller for POST request to '/admin/settings/page/delete'
 * @param {*} req
 * @param {*} res
 */
exports.postAdminSettingsPageDelete = async (req, res) => {
  const db = req.app.db;

  const page = await db.pages.findOne({ _id: getId(req.body.pageId) });
  if (!page) {
    res.status(400).json({ message: "Page not found" });
    return;
  }

  try {
    await db.pages.deleteOne({ _id: getId(req.body.pageId) }, {});
    res.status(200).json({ message: "Page successfully deleted" });
    return;
  } catch (ex) {
    res.status(400).json({ message: "Error deleting page. Please try again." });
  }
};
