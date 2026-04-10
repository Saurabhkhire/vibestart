export class HttpError extends Error {
  /**
   * @param {number} status HTTP status
   * @param {string} message
   * @param {{ detail?: string }} [opts]
   */
  constructor(status, message, opts = {}) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    if (opts.detail) this.detail = opts.detail;
  }
}
