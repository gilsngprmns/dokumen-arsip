// Middleware bersama untuk endpoint khusus admin.
// Sebelumnya array [authMiddleware, roleMiddleware("admin")] diduplikasi
// di banyak file route; sekarang cukup satu sumber.

const authMiddleware = require("./authMiddleware");
const roleMiddleware = require("./roleMiddleware");

const adminOnly = [authMiddleware, roleMiddleware("admin")];

module.exports = adminOnly;
