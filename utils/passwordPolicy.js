const { getSecurityPolicy, DEFAULT_POLICY } = require('../services/securityPolicy.service');

function buildPasswordRules(policy = DEFAULT_POLICY) {
  const minLength = policy.passwordMinLength || DEFAULT_POLICY.passwordMinLength;
  const rules = [
    {
      test: (p) => p.length >= minLength,
      message: `Password must be at least ${minLength} characters`,
    },
  ];
  if (policy.requireStrongPassword !== false) {
    rules.push(
      {
        test: (p) => /[a-zA-Z]/.test(p),
        message: 'Password must contain at least one letter',
      },
      {
        test: (p) => /\d/.test(p),
        message: 'Password must contain at least one number',
      }
    );
  }
  return rules;
}

function validatePassword(password, policyOverride) {
  if (typeof password !== 'string') {
    return { valid: false, message: 'Password is required' };
  }
  const policy = policyOverride || getSecurityPolicy();
  const rules = buildPasswordRules(policy);
  for (const rule of rules) {
    if (!rule.test(password)) {
      return { valid: false, message: rule.message };
    }
  }
  return { valid: true };
}

function passwordPolicyMessage(policyOverride) {
  const policy = policyOverride || getSecurityPolicy();
  const min = policy.passwordMinLength || DEFAULT_POLICY.passwordMinLength;
  if (policy.requireStrongPassword === false) {
    return `Password must be at least ${min} characters`;
  }
  return `Password must be at least ${min} characters and include at least one letter and one number`;
}

module.exports = {
  buildPasswordRules,
  validatePassword,
  passwordPolicyMessage,
};
