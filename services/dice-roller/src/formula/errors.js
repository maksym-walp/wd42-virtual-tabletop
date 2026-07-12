class FormulaError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'FormulaError';
    this.statusCode = statusCode;
  }
}

module.exports = { FormulaError };
