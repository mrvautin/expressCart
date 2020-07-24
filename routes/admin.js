const { restrict, checkAccess } = require("../lib/auth");
const express = require("express");
const router = express.Router();
const multer = require("multer");
const csrf = require("csurf");
const escape = require("html-entities").AllHtmlEntities;
const colors = require("colors");
const bcrypt = require("bcryptjs");
const moment = require("moment");
const fs = require("fs");
const path = require("path");
const mime = require("mime-type/with-db");
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
router.post(
  "/admin/settings/menu/new",
  restrict,
  checkAccess,
  adminController.postAdminSettingsNewMenuItemController
);

// update existing menu item
router.post(
  "/admin/settings/menu/update",
  restrict,
  checkAccess,
  adminController.postAdminSettingsUpdateMenuItemController
);

// delete menu item
router.post(
  "/admin/settings/menu/delete",
  restrict,
  checkAccess,
  adminController.postAdminSettingsDeleteMenuItemController
);

// We call this via a Ajax call to save the order from the sortable list
router.post(
  "/admin/settings/menu/saveOrder",
  restrict,
  checkAccess,
  adminController.postAdminSettingsMenuSaveOrderController
);

// validate the permalink
router.post(
  "/admin/validatePermalink",
  adminController.postAdminValidatePermanentLinkController
);

// Discount codes
router.get(
  "/admin/settings/discounts",
  csrfProtection,
  restrict,
  checkAccess,
  adminController.getAdminSettingsDiscountsController
);

// Edit a discount code
router.get(
  "/admin/settings/discount/edit/:id",
  csrfProtection,
  restrict,
  checkAccess,
  adminController.getAdminSettingsDiscountEditController
);

// Update discount code
router.post(
  "/admin/settings/discount/update",
  restrict,
  checkAccess,
  adminController.postAdminSettingsUpdateDiscountCodeController
);

// Create a discount code
router.get(
  "/admin/settings/discount/new",
  csrfProtection,
  restrict,
  checkAccess,
  adminController.getAdminSettingsNewDiscountCode
);

// Create a discount code
router.post(
  "/admin/settings/discount/create",
  csrfProtection,
  restrict,
  checkAccess,
  adminController.getAdminSettingsNewDiscountCodeController
);

// Delete discount code
router.delete(
  "/admin/settings/discount/delete",
  restrict,
  checkAccess,
  adminController.deleteAdminSettingsDeleteDiscountCodeController
);

// upload the file
const upload = multer({ dest: "public/uploads/" });
router.post(
  "/admin/file/upload",
  restrict,
  checkAccess,
  upload.single("uploadFile"),
  adminController.postAdminFileUploadController
);

// delete a file via ajax request
router.post(
  "/admin/testEmail",
  restrict,
  adminController.postAdminTestEmailController
);

router.post(
  "/admin/searchall",
  restrict,
  adminController.postAdminSearchAllController
);

module.exports = router;
