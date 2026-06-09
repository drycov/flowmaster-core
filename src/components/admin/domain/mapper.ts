import { ApiUser, User } from "./types";
import { isRole } from "./roles";

export function mapUser(user: ApiUser): User {
  return {
    ...user,
    roles: (user.roles ?? []).filter(isRole),
  };
}
