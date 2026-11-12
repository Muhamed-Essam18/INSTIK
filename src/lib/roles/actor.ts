import type { RoleName } from "./rules";

/**
 * The signed-in person acting on the server, with the role that was resolved for this request.
 * `isCreator` is true when the stored account role is creator, even if `role` resolved to owner (an owner email that
 * belongs to an existing creator): that person reaches both areas.
 */
export type Actor = { id: string; email: string; name: string | null; role: RoleName; isCreator?: boolean };

/** Whether the actor may use the area of `role`: their resolved role, or the creator area for an owner who is also a creator. */
export const hasRole = (actor: Pick<Actor, "role" | "isCreator">, role: RoleName): boolean =>
  actor.role === role || (role === "creator" && actor.isCreator === true);
