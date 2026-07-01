const MIN_PASSWORD_LENGTH = 8;

const PASSWORD_RULES = [
  {
    test: (p) => p.length >= MIN_PASSWORD_LENGTH,
    message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
  },
  {
    test: (p) => /[a-zA-Z]/.test(p),
    message: 'Password must contain at least one letter',
  },
  {
    test: (p) => /\d/.test(p),
    message: 'Password must contain at least one number',
  },
];

function validatePassword(password) {
  if (typeof password !== 'string') {
    return { valid: false, message: 'Password is required' };
  }
  for (const rule of PASSWORD_RULES) {
    if (!rule.test(password)) {
      return { valid: false, message: rule.message };
    }
  }
  return { valid: true };
}

function passwordPolicyMessage() {
  return `Password must be at least ${MIN_PASSWORD_LENGTH} characters and include at least one letter and one number`;
}

module.exports = {
  MIN_PASSWORD_LENGTH,
  PASSWORD_RULES,
  validatePassword,
  passwordPolicyMessage,
};
