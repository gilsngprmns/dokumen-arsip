// Middleware validasi parameter route bertipe ID (misalnya :id atau :versionId).
// Tanpa ini, ID non-numeric dikirim ke PostgreSQL dan menghasilkan error 500
// padahal seharusnya 400.

const requireIdParam = (paramName = "id") => (req, res, next) => {
  const value = req.params[paramName];
  if (!/^\d{1,9}$/.test(String(value ?? ""))) {
    return res.status(400).json({
      success: false,
      message: `Parameter ${paramName} harus berupa angka yang valid`,
    });
  }
  return next();
};

module.exports = { requireIdParam };
