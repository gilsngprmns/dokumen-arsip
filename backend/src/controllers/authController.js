const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const pool = require("../config/database");
const logActivity = require("../services/activityLogService");
const serializeUser = require("../utils/serializeUser");
const validators = require("../utils/validators");

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET belum dikonfigurasi");
  }

  return process.env.JWT_SECRET;
};

const createToken = (user) =>
  jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.nama_role,
      seksi_id: user.seksi_id,
    },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
  );

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username dan password wajib diisi",
      });
    }

    const usernameCheck = validators.validateUsername(username, "Username");
    if (usernameCheck.error) return validators.badRequest(res, usernameCheck.error);

    const result = await pool.query(
      `
      SELECT
        u.id,
        u.nama,
        u.username,
        u.email,
        u.password,
        u.seksi_id,
        u.status,
        r.nama_role,
        s.nama_seksi
      FROM users u
      JOIN roles r ON r.id = u.role_id
      LEFT JOIN seksi s ON s.id = u.seksi_id
      WHERE u.username = $1
      `,
      [usernameCheck.value]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Username atau password salah",
      });
    }

    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Username atau password salah",
      });
    }

    if (user.status === false) {
      return res.status(403).json({
        success: false,
        message: "Akun tidak aktif",
      });
    }

    const token = createToken(user);
    await logActivity({
      userId: user.id,
      activity: "LOGIN",
      description: "User berhasil login",
    });

    return res.status(200).json({
      success: true,
      message: "Login berhasil",
      data: {
        token,
        user: serializeUser(user),
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Gagal melakukan login",
    });
  }
};

const getMe = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        u.id,
        u.nama,
        u.username,
        u.email,
        u.seksi_id,
        u.status,
        r.nama_role,
        s.nama_seksi
      FROM users u
      JOIN roles r ON r.id = u.role_id
      LEFT JOIN seksi s ON s.id = u.seksi_id
      WHERE u.id = $1
      `,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan",
      });
    }

    return res.status(200).json({
      success: true,
      data: serializeUser(result.rows[0]),
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil data user",
    });
  }
};

module.exports = { login, getMe };