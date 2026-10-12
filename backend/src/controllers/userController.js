const bcrypt = require("bcryptjs");

const pool = require("../config/database");
const logActivity = require("../services/activityLogService");
const serializeUser = require("../utils/serializeUser");
const validators = require("../utils/validators");

const userSelect = `
  SELECT
    u.id,
    u.nama,
    u.username,
    u.email,
    u.seksi_id,
    u.status,
    u.created_at,
    u.updated_at,
    r.nama_role,
    s.nama_seksi
  FROM users u
  JOIN roles r ON r.id = u.role_id
  LEFT JOIN seksi s ON s.id = u.seksi_id
`;

const isSelf = (req, targetId) => String(req.user.id) === String(targetId);

// Validasi kombinasi role + seksi dan pastikan seksi benar-benar ada.
const validateRoleAndSection = async (role, seksiId) => {
  const roleCheck = validators.validateEnum(role, "Role", ["admin", "staff"]);
  if (roleCheck.error) return roleCheck.error;

  const seksiCheck = validators.validateOptionalIntegerId(seksiId, "Seksi");
  if (seksiCheck.error) return seksiCheck.error;
  const validSeksiId = seksiCheck.value;

  if (roleCheck.value === "staff" && !validSeksiId) {
    return "Staff wajib memiliki seksi";
  }

  if (roleCheck.value === "admin" && validSeksiId) {
    return "Admin tidak boleh memiliki seksi";
  }

  if (validSeksiId) {
    const section = await pool.query(
      "SELECT id FROM seksi WHERE id = $1",
      [validSeksiId]
    );

    if (section.rows.length === 0) {
      return "Seksi tidak ditemukan";
    }
  }

  return null;
};

const getRoleId = async (role) => {
  const result = await pool.query(
    "SELECT id FROM roles WHERE nama_role = $1",
    [role]
  );

  return result.rows[0] ? result.rows[0].id : null;
};

const getAllUsers = async (req, res) => {
  try {
    const result = await pool.query(`${userSelect} ORDER BY u.id ASC`);

    return res.status(200).json({
      success: true,
      message: "Data user berhasil diambil",
      data: result.rows.map(serializeUser),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Gagal mengambil data user",
    });
  }
};

const createUser = async (req, res) => {
  try {
    const {
      nama,
      username,
      email,
      password,
      role = "staff",
      seksi_id: seksiId = null,
    } = req.body;

    const namaCheck = validators.validateString(nama, "Nama", { max: validators.MAX_LENGTH.nama });
    if (namaCheck.error) return validators.badRequest(res, namaCheck.error);

    const usernameCheck = validators.validateUsername(username, "Username");
    if (usernameCheck.error) return validators.badRequest(res, usernameCheck.error);

    const emailCheck = validators.validateEmail(email, "Email", { allowNull: true });
    if (emailCheck.error) return validators.badRequest(res, emailCheck.error);

    const passwordCheck = validators.validatePassword(password, "Password");
    if (passwordCheck.error) return validators.badRequest(res, passwordCheck.error);

    const validationError = await validateRoleAndSection(role, seksiId);
    if (validationError) {
      return validators.badRequest(res, validationError);
    }

    const roleId = await getRoleId(role);
    if (!roleId) {
      return res.status(500).json({
        success: false,
        message: "Role belum tersedia di database",
      });
    }
    const passwordHash = await bcrypt.hash(passwordCheck.value, 12);
    const result = await pool.query(
      `
      INSERT INTO users (nama, username, email, password, role_id, seksi_id, status)
      VALUES ($1, $2, $3, $4, $5, $6, TRUE)
      RETURNING id
      `,
      [namaCheck.value, usernameCheck.value, emailCheck.value, passwordHash, roleId, seksiId]
    );

    const user = await pool.query(`${userSelect} WHERE u.id = $1`, [
      result.rows[0].id,
    ]);
    await logActivity({
      userId: req.user.id,
      activity: "CREATE_USER",
      description: `Membuat user ${usernameCheck.value}`,
    });

    return res.status(201).json({
      success: true,
      message: "User berhasil dibuat",
      data: serializeUser(user.rows[0]),
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Username atau email sudah digunakan",
      });
    }

    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Gagal membuat user",
    });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nama,
      username,
      email,
      role,
      seksi_id: seksiId = null,
    } = req.body;

    const namaCheck = validators.validateString(nama, "Nama", { max: validators.MAX_LENGTH.nama });
    if (namaCheck.error) return validators.badRequest(res, namaCheck.error);

    const usernameCheck = validators.validateUsername(username, "Username");
    if (usernameCheck.error) return validators.badRequest(res, usernameCheck.error);

    const emailCheck = validators.validateEmail(email, "Email", { allowNull: true });
    if (emailCheck.error) return validators.badRequest(res, emailCheck.error);

    const validationError = await validateRoleAndSection(role, seksiId);
    if (validationError) {
      return validators.badRequest(res, validationError);
    }

    // Cegah admin menurunkan role dirinya sendiri (self-lockout).
    if (isSelf(req, id) && role !== "admin") {
      return validators.badRequest(res, "Anda tidak dapat mengubah role akun Anda sendiri");
    }

    const roleId = await getRoleId(role);
    if (!roleId) {
      return res.status(500).json({
        success: false,
        message: "Role belum tersedia di database",
      });
    }
    const result = await pool.query(
      `
      UPDATE users
      SET
        nama = $1,
        username = $2,
        email = $3,
        role_id = $4,
        seksi_id = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING id
      `,
      [namaCheck.value, usernameCheck.value, emailCheck.value, roleId, seksiId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan",
      });
    }

    const user = await pool.query(`${userSelect} WHERE u.id = $1`, [id]);
    await logActivity({
      userId: req.user.id,
      activity: "UPDATE_USER",
      description: `Memperbarui user ${id}`,
    });
    return res.status(200).json({
      success: true,
      message: "User berhasil diperbarui",
      data: serializeUser(user.rows[0]),
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Username atau email sudah digunakan",
      });
    }

    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Gagal memperbarui user",
    });
  }
};

const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (![true, false, "aktif", "nonaktif"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status harus aktif atau nonaktif",
      });
    }

    const isActive = status === true || status === "aktif";

    // Cegah admin menonaktifkan akunnya sendiri (self-lockout).
    if (isSelf(req, id) && !isActive) {
      return validators.badRequest(res, "Anda tidak dapat menonaktifkan akun Anda sendiri");
    }

    const result = await pool.query(
      `
      UPDATE users
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id
      `,
      [isActive, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan",
      });
    }
    await logActivity({
      userId: req.user.id,
      activity: "UPDATE_USER",
      description: `Mengubah status user ${id}`,
    });

    return res.status(200).json({
      success: true,
      message: "Status user berhasil diperbarui",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Gagal memperbarui status user",
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    const passwordCheck = validators.validatePassword(password, "Password baru");
    if (passwordCheck.error) return validators.badRequest(res, passwordCheck.error);

    const passwordHash = await bcrypt.hash(passwordCheck.value, 12);
    const result = await pool.query(
      `
      UPDATE users
      SET password = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id
      `,
      [passwordHash, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan",
      });
    }
    await logActivity({
      userId: req.user.id,
      activity: "UPDATE_USER",
      description: `Mereset password user ${id}`,
    });

    return res.status(200).json({
      success: true,
      message: "Password user berhasil direset",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Gagal mereset password user",
    });
  }
};

module.exports = {
  getAllUsers,
  createUser,
  updateUser,
  updateStatus,
  resetPassword,
};