const jwt = require("jsonwebtoken");
const pool = require("../config/database");

const authMiddleware = async (req, res, next) => {
  const authorization = req.headers.authorization;
  const token = authorization && authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Token autentikasi wajib disertakan",
    });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({
      success: false,
      message: "JWT_SECRET belum dikonfigurasi",
    });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query(
      `SELECT u.id, u.username, u.seksi_id, u.status, r.nama_role AS role
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
      [req.user.id],
    );
    const currentUser = result.rows[0];
    if (!currentUser || !currentUser.status) {
      return res.status(401).json({ success: false, message: "Akun tidak aktif atau tidak ditemukan" });
    }
    req.user = { ...req.user, ...currentUser };
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Token tidak valid atau sudah kedaluwarsa",
    });
  }
};

module.exports = authMiddleware;