import type { RoleName } from "./rules";

/** The signed-in person acting on the server, with the role that was resolved for this request. */
export type Actor = { id: string; email: string; name: string | null; role: RoleName };
