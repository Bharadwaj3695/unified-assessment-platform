// Import bcryptjs library for one-way cryptographic password hashing and verification
const bcrypt = require('bcryptjs');

// Computes a secure one-way salted hash of a plaintext user password
const hashPassword = async (password) => {
  // Generate random cryptographic salt with cost factor of 10 rounds
  const salt = await bcrypt.genSalt(10);
  // Hash the plaintext password with the generated salt and return the hash string
  return bcrypt.hash(password, salt);
};

// Validates a plaintext candidate password against a previously computed bcrypt hash
const comparePassword = async (enteredPassword, hashedPassword) => {
  // Perform constant-time bcrypt comparison and return boolean match result
  return bcrypt.compare(enteredPassword, hashedPassword);
};

// Export password hashing and comparison utility functions
module.exports = {
  hashPassword,
  comparePassword,
};
