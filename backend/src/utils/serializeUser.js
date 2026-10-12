// Serializer user tunggal yang dipakai oleh authController dan userController
// agar bentuk respons konsisten dan tidak pernah membocorkan field sensitif
// (misalnya password).

const serializeUser = (user) => ({
  id: user.id,
  nama: user.nama,
  username: user.username,
  email: user.email,
  role: user.nama_role,
  seksi_id: user.seksi_id,
  nama_seksi: user.nama_seksi,
  status: user.status ? "aktif" : "nonaktif",
  created_at: user.created_at,
  updated_at: user.updated_at,
});

module.exports = serializeUser;
