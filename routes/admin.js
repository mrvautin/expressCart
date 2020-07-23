const { restrict, checkAccess } = require("../lib/auth");
const express = require("express");
const router = express.Router();
const csrfProtection = csrf({ cookie: true });

// Controller Imports
const adminController = require("../controllers/admin");

// Admin section
router.get("/admin", restrict, adminController.getAdminController);

// logout
router.get("/admin/logout", adminController.getAdminLogoutController);

// Used for tests only
if (process.env.NODE_ENV === "test") {
  router.get("/admin/csrf", csrfProtection, adminController.getCSRFController);
}

// login form
router.get("/admin/login", adminController.getAdminLoginController);

// login the user and check the password
router.post("/admin/login_action", adminController.postAdminLoginController);

// setup form is shown when there are no users setup in the DB
router.get("/admin/setup", adminController.getAdminSetupController);

// insert a user
router.post("/admin/setup_action", adminController.postAdminSetupController);

// dashboard
router.get(
  "/admin/dashboard",
  csrfProtection,
  restrict,
  adminController.getAdminDashboardController
);

// settings
router.get(
  "/admin/settings",
  csrfProtection,
  restrict,
  adminController.getAdminSettingsController
);

// create API key
router.post(
  "/admin/createApiKey",
  restrict,
  checkAccess,
  adminController.postAdminCreateAPIKeyController
);

// settings update
router.post(
  "/admin/settings/update",
  restrict,
  checkAccess,
  adminController.postAdminSettingsUpdateController
);

// settings menu
router.get(
  "/admin/settings/menu",
  csrfProtection,
  restrict,
  adminController.getAdminSettingsMenuController
);

// page list
router.get(
  "/admin/settings/pages",
  csrfProtection,
  restrict,
  adminController.getAdminSettingsPagesController
);

// pages new
router.get(
  "/admin/settings/pages/new",
  csrfProtection,
  restrict,
  checkAccess,
  adminController.getAdminSettingsPagesNewController
);

// pages editor
router.get(
  "/admin/settings/pages/edit/:page",
  csrfProtection,
  restrict,
  checkAccess,
  adminController.getAdminSettingsPagesEditController
);

// insert/update page
router.post(
  "/admin/settings/page",
  restrict,
  checkAccess,
  adminController.getAdminSettingsPageInsertOrUpdateController
);

// delete a page
router.post(
  "/admin/settings/page/delete",
  restrict,
  checkAccess,
  adminController.postAdminSettingsPageDelete
);

// new menu item
router.post("/admin/settings/menu/new", restrict, checkAccess, (req, res) => {
  const result = newMenu(req);
  if (result === false) {
    res.status(400).json({ message: "Failed creating menu." });
    return;
  }
  res.status(200).json({ message: "Menu created successfully." });
});

// update existing menu item
router.post(
  "/admin/settings/menu/update",
  restrict,
  checkAccess,
  (req, res) => {
    const result = updateMenu(req);
    if (result === false) {
      res.status(400).json({ message: "Failed updating menu." });
      return;
    }
    res.status(200).json({ message: "Menu updated successfully." });
  }
);

// delete menu item
router.post(
  "/admin/settings/menu/delete",
  restrict,
  checkAccess,
  (req, res) => {
    const result = deleteMenu(req, req.body.menuId);
    if (result === false) {
      res.status(400).json({ message: "Failed deleting menu." });
      return;
    }
    res.status(200).json({ message: "Menu deleted successfully." });
  }
);

// We call this via a Ajax call to save the order from the sortable list
router.post(
  "/admin/settings/menu/saveOrder",
  restrict,
  checkAccess,
  (req, res) => {
    const result = orderMenu(req, res);
    if (result === false) {
      res.status(400).json({ message: "Failed saving menu order" });
      return;
    }
    res.status(200).json({});
  }
);

// validate the permalink
router.post("/admin/validatePermalink", async (req, res) => {
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
});

// Discount codes
router.get(
  "/admin/settings/discounts",
  csrfProtection,
  restrict,
  checkAccess,
  async (req, res) => {
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
  }
);

// Edit a discount code
router.get(
  "/admin/settings/discount/edit/:id",
  csrfProtection,
  restrict,
  checkAccess,
  async (req, res) => {
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
  }
);

// Update discount code
router.post(
  "/admin/settings/discount/update",
  restrict,
  checkAccess,
  async (req, res) => {
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
  }
);

// Create a discount code
router.get(
  "/admin/settings/discount/new",
  csrfProtection,
  restrict,
  checkAccess,
  async (req, res) => {
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
  }
);

// Create a discount code
router.post(
  "/admin/settings/discount/create",
  csrfProtection,
  restrict,
  checkAccess,
  async (req, res) => {
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
  }
);

// Delete discount code
router.delete(
  "/admin/settings/discount/delete",
  restrict,
  checkAccess,
  async (req, res) => {
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
  }
);

// upload the file
const upload = multer({ dest: "public/uploads/" });
router.post(
  "/admin/file/upload",
  restrict,
  checkAccess,
  upload.single("uploadFile"),
  async (req, res) => {
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
        res
          .status(400)
          .json({ message: "File upload error. Please try again." });
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
        res
          .status(400)
          .json({ message: "File upload error. Please try again." });
      }
    } else {
      // Return error
      console.log("fail", req.file);
      res.status(400).json({ message: "File upload error. Please try again." });
    }
  }
);

// delete a file via ajax request
router.post("/admin/testEmail", restrict, (req, res) => {
  const config = req.app.config;
  // TODO: Should fix this to properly handle result
  sendEmail(
    config.emailAddress,
    "expressCart test email",
    "Your email settings are working"
  );
  res.status(200).json({ message: "Test email sent" });
});

router.post("/admin/searchall", restrict, async (req, res, next) => {
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
});

module.exports = router;
