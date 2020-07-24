const escape = require("html-entities").AllHtmlEntities;
const colors = require("colors");
const bcrypt = require("bcryptjs");
const moment = require("moment");
const fs = require("fs");
const path = require("path");
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

/**
 * Controller for POST request to '/admin/settings/menu/new'
 * @param {*} req
 * @param {*} res
 */
exports.postAdminSettingsNewMenuItemController = (req, res) => {
  const result = newMenu(req);
  if (result === false) {
    res.status(400).json({ message: "Failed creating menu." });
    return;
  }
  res.status(200).json({ message: "Menu created successfully." });
};

/**
 * Controller for POST request to '/admin/settings/menu/update'
 * @param {*} req
 * @param {*} res
 */
exports.postAdminSettingsUpdateMenuItemController = (req, res) => {
  const result = updateMenu(req);
  if (result === false) {
    res.status(400).json({ message: "Failed updating menu." });
    return;
  }
  res.status(200).json({ message: "Menu updated successfully." });
};

/**
 * Controller for POST request to '/admin/settings/menu/update'
 * @param {*} req
 * @param {*} res
 */
exports.postAdminSettingsDeleteMenuItemController = (req, res) => {
  const result = deleteMenu(req, req.body.menuId);
  if (result === false) {
    res.status(400).json({ message: "Failed deleting menu." });
    return;
  }
  res.status(200).json({ message: "Menu deleted successfully." });
};

/**
 * Controller for POST request to '/admin/settings/menu/saveOrders'
 * @param {*} req
 * @param {*} res
 */
exports.postAdminSettingsMenuSaveOrderController = (req, res) => {
  const result = orderMenu(req, res);
  if (result === false) {
    res.status(400).json({ message: "Failed saving menu order" });
    return;
  }
  res.status(200).json({});
};

/**
 * Controller for POST request to 'admin/validatePermalink'
 * @param {*} req
 * @param {*} res
 */
exports.postAdminValidatePermanentLinkController = async (req, res) => {
  // if doc id is provided it checks for permalink in any products other that one provided,
  // else it just checks for any products with that permalink
  const db = req.app.db;

  let query = {};
  if (typeof req.body.docId === "undefined" || req.body.docId === "") {
    query = { productPermalink: req.body.permalink };
  } else {
    query = {
      productPermalink: req.body.permalink,
      _id: { $ne: getId(req.body.docId) },
    };
  }

  const products = await db.products.countDocuments(query);
  if (products && products > 0) {
    res.status(400).json({ message: "Permalink already exists" });
    return;
  }
  res.status(200).json({ message: "Permalink validated successfully" });
};

/**
 * Controller for GET request to '/admin/settings/discounts'
 * @param {*} req
 * @param {*} res
 */
exports.getAdminSettingsDiscountsController = async (req, res) => {
  const db = req.app.db;

  const discounts = await db.discounts.find({}).toArray();

  res.render("settings-discounts", {
    title: "Discount code",
    config: req.app.config,
    session: req.session,
    discounts,
    admin: true,
    message: clearSessionValue(req.session, "message"),
    messageType: clearSessionValue(req.session, "messageType"),
    helpers: req.handlebars.helpers,
    csrfToken: req.csrfToken(),
  });
};

/**
 * Controller for GET request to '/admin/settings/discount/edit/:id'
 * @param {*} req
 * @param {*} res
 */
exports.getAdminSettingsDiscountEditController = async (req, res) => {
  const db = req.app.db;

  const discount = await db.discounts.findOne({ _id: getId(req.params.id) });

  res.render("settings-discount-edit", {
    title: "Discount code edit",
    session: req.session,
    admin: true,
    discount,
    message: clearSessionValue(req.session, "message"),
    messageType: clearSessionValue(req.session, "messageType"),
    helpers: req.handlebars.helpers,
    config: req.app.config,
    csrfToken: req.csrfToken(),
  });
};

/**
 * Controller for POST request to '/admin/settings/discount/update'
 * @param {*} req
 * @param {*} res
 */
exports.postAdminSettingsUpdateDiscountCodeController = async (req, res) => {
  const db = req.app.db;

  // Doc to insert
  const discountDoc = {
    discountId: req.body.discountId,
    code: req.body.code,
    type: req.body.type,
    value: parseInt(req.body.value),
    start: moment(req.body.start, "DD/MM/YYYY HH:mm").toDate(),
    end: moment(req.body.end, "DD/MM/YYYY HH:mm").toDate(),
  };

  // Validate the body again schema
  const schemaValidate = validateJson("editDiscount", discountDoc);
  if (!schemaValidate.result) {
    res.status(400).json(schemaValidate.errors);
    return;
  }

  // Check start is after today
  if (moment(discountDoc.start).isBefore(moment())) {
    res
      .status(400)
      .json({ message: "Discount start date needs to be after today" });
    return;
  }

  // Check end is after the start
  if (!moment(discountDoc.end).isAfter(moment(discountDoc.start))) {
    res
      .status(400)
      .json({ message: "Discount end date needs to be after start date" });
    return;
  }

  // Check if code exists
  const checkCode = await db.discounts.countDocuments({
    code: discountDoc.code,
    _id: { $ne: getId(discountDoc.discountId) },
  });
  if (checkCode) {
    res.status(400).json({ message: "Discount code already exists" });
    return;
  }

  // Remove discountID
  delete discountDoc.discountId;

  try {
    await db.discounts.updateOne(
      { _id: getId(req.body.discountId) },
      { $set: discountDoc },
      {}
    );
    res
      .status(200)
      .json({ message: "Successfully saved", discount: discountDoc });
  } catch (ex) {
    res.status(400).json({ message: "Failed to save. Please try again" });
  }
};

/**
 * Controller for GET request to '/admin/settings/discount/new'
 * @param {*} req
 * @param {*} res
 */
exports.getAdminSettingsNewDiscountCodeController = async (req, res) => {
  res.render("settings-discount-new", {
    title: "Discount code create",
    session: req.session,
    admin: true,
    message: clearSessionValue(req.session, "message"),
    messageType: clearSessionValue(req.session, "messageType"),
    helpers: req.handlebars.helpers,
    config: req.app.config,
    csrfToken: req.csrfToken(),
  });
};

/**
 * Controller for POST request to '/admin/settings/discount/create'
 * @param {*} req
 * @param {*} res
 */
exports.postAdminSettingsCreateDiscountCode = async (req, res) => {
  const db = req.app.db;

  // Doc to insert
  const discountDoc = {
    code: req.body.code,
    type: req.body.type,
    value: parseInt(req.body.value),
    start: moment(req.body.start, "DD/MM/YYYY HH:mm").toDate(),
    end: moment(req.body.end, "DD/MM/YYYY HH:mm").toDate(),
  };

  // Validate the body again schema
  const schemaValidate = validateJson("newDiscount", discountDoc);
  if (!schemaValidate.result) {
    res.status(400).json(schemaValidate.errors);
    return;
  }

  // Check if code exists
  const checkCode = await db.discounts.countDocuments({
    code: discountDoc.code,
  });
  if (checkCode) {
    res.status(400).json({ message: "Discount code already exists" });
    return;
  }

  // Check start is after today
  if (moment(discountDoc.start).isBefore(moment())) {
    res
      .status(400)
      .json({ message: "Discount start date needs to be after today" });
    return;
  }

  // Check end is after the start
  if (!moment(discountDoc.end).isAfter(moment(discountDoc.start))) {
    res
      .status(400)
      .json({ message: "Discount end date needs to be after start date" });
    return;
  }

  // Insert discount code
  const discount = await db.discounts.insertOne(discountDoc);
  res.status(200).json({
    message: "Discount code created successfully",
    discountId: discount.insertedId,
  });
};

/**
 * Controller for DELETE request to '/admin/settings/discount/delete'
 * @param {*} req
 * @param {*} res
 */
exports.deleteAdminSettingsDeleteDiscountCodeController = async (req, res) => {
  const db = req.app.db;

  try {
    await db.discounts.deleteOne({ _id: getId(req.body.discountId) }, {});
    res.status(200).json({ message: "Discount code successfully deleted" });
    return;
  } catch (ex) {
    res
      .status(400)
      .json({ message: "Error deleting discount code. Please try again." });
  }
};

/**
 * Controller for POST request to '/admin/file/upload'
 * @param {*} req
 * @param {*} res
 */
exports.postAdminFileUploadController = async (req, res) => {
  const db = req.app.db;

  if (req.file) {
    const file = req.file;

    // Get the mime type of the file
    const mimeType = mime.lookup(file.originalname);

    // Check for allowed mime type and file size
    if (!allowedMimeType.includes(mimeType) || file.size > fileSizeLimit) {
      // Remove temp file
      fs.unlinkSync(file.path);

      // Return error
      res.status(400).json({
        message: "File type not allowed or too large. Please try again.",
      });
      return;
    }

    // get the product form the DB
    const product = await db.products.findOne({
      _id: getId(req.body.productId),
    });
    if (!product) {
      // delete the temp file.
      fs.unlinkSync(file.path);

      // Return error
      res.status(400).json({ message: "File upload error. Please try again." });
      return;
    }

    const productPath = product._id.toString();
    const uploadDir = path.join("public/uploads", productPath);

    // Check directory and create (if needed)
    checkDirectorySync(uploadDir);

    // Setup the new path
    const imagePath = path.join(
      "/uploads",
      productPath,
      file.originalname.replace(/ /g, "_")
    );

    // save the new file
    const dest = fs.createWriteStream(
      path.join(uploadDir, file.originalname.replace(/ /g, "_"))
    );
    const pipeline = util.promisify(stream.pipeline);

    try {
      await pipeline(fs.createReadStream(file.path), dest);

      // delete the temp file.
      fs.unlinkSync(file.path);

      // if there isn't a product featured image, set this one
      if (!product.productImage) {
        await db.products.updateOne(
          { _id: getId(req.body.productId) },
          { $set: { productImage: imagePath } },
          { multi: false }
        );
      }
      res.status(200).json({ message: "File uploaded successfully" });
    } catch (ex) {
      console.log("Failed to upload the file", ex);
      res.status(400).json({ message: "File upload error. Please try again." });
    }
  } else {
    // Return error
    console.log("fail", req.file);
    res.status(400).json({ message: "File upload error. Please try again." });
  }
};

/**
 * Controller for POST request to '/admin/testEmail'
 * @param {*} req
 * @param {*} res
 */
exports.postAdminTestEmailController = (req, res) => {
  const config = req.app.config;
  // TODO: Should fix this to properly handle result
  sendEmail(
    config.emailAddress,
    "expressCart test email",
    "Your email settings are working"
  );
  res.status(200).json({ message: "Test email sent" });
};

/**
 * Controller for POST request to '/admin/searchall'
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
exports.postAdminSearchAllController = async (req, res, next) => {
  const db = req.app.db;
  const searchValue = req.body.searchValue;
  const limitReturned = 5;

  // Empty arrays
  let customers = [];
  let orders = [];
  let products = [];

  // Default queries
  const customerQuery = {};
  const orderQuery = {};
  const productQuery = {};

  // If an ObjectId is detected use that
  if (ObjectId.isValid(req.body.searchValue)) {
    // Get customers
    customers = await db.customers
      .find({
        _id: ObjectId(searchValue),
      })
      .limit(limitReturned)
      .sort({ created: 1 })
      .toArray();

    // Get orders
    orders = await db.orders
      .find({
        _id: ObjectId(searchValue),
      })
      .limit(limitReturned)
      .sort({ orderDate: 1 })
      .toArray();

    // Get products
    products = await db.products
      .find({
        _id: ObjectId(searchValue),
      })
      .limit(limitReturned)
      .sort({ productAddedDate: 1 })
      .toArray();

    return res.status(200).json({
      customers,
      orders,
      products,
    });
  }

  // If email address is detected
  if (emailRegex.test(req.body.searchValue)) {
    customerQuery.email = searchValue;
    orderQuery.orderEmail = searchValue;
  } else if (numericRegex.test(req.body.searchValue)) {
    // If a numeric value is detected
    orderQuery.amount = req.body.searchValue;
    productQuery.productPrice = req.body.searchValue;
  } else {
    // String searches
    customerQuery.$or = [
      { firstName: { $regex: new RegExp(searchValue, "img") } },
      { lastName: { $regex: new RegExp(searchValue, "img") } },
    ];
    orderQuery.$or = [
      { orderFirstname: { $regex: new RegExp(searchValue, "img") } },
      { orderLastname: { $regex: new RegExp(searchValue, "img") } },
    ];
    productQuery.$or = [
      { productTitle: { $regex: new RegExp(searchValue, "img") } },
      { productDescription: { $regex: new RegExp(searchValue, "img") } },
    ];
  }

  // Get customers
  if (Object.keys(customerQuery).length > 0) {
    customers = await db.customers
      .find(customerQuery)
      .limit(limitReturned)
      .sort({ created: 1 })
      .toArray();
  }

  // Get orders
  if (Object.keys(orderQuery).length > 0) {
    orders = await db.orders
      .find(orderQuery)
      .limit(limitReturned)
      .sort({ orderDate: 1 })
      .toArray();
  }

  // Get products
  if (Object.keys(productQuery).length > 0) {
    products = await db.products
      .find(productQuery)
      .limit(limitReturned)
      .sort({ productAddedDate: 1 })
      .toArray();
  }

  return res.status(200).json({
    customers,
    orders,
    products,
  });
};
