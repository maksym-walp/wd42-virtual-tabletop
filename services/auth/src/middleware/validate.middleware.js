const { validationResult } = require('express-validator');

function validate(validations) {
  return async (req, res, next) => {
    for (const v of validations) await v.run(req);
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  };
}

module.exports = validate;
