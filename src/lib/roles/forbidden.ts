/** Thrown when someone calls a function their role does not allow. No data is returned with it. */
export class ForbiddenError extends Error {
  constructor() {
    super("Forbidden");
    this.name = "ForbiddenError";
  }
}
