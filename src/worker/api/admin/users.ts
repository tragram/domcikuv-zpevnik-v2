import { buildApp } from "../utils";
import { zValidator } from "@hono/zod-validator";
import {
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  updateUserSchema,
  userSearchSchema,
  createUser,
  createUserSchema,
} from "../../helpers/user-helpers";
import { failJSend, itemNotFoundFail, successJSend } from "../responses";

export const userRoutes = buildApp()
  .get("/", zValidator("query", userSearchSchema), async (c) => {
    const { search, limit, offset } = c.req.valid("query");
    return successJSend(c, await getUsers(c.var.db, search, limit, offset));
  })
  .post("/", zValidator("json", createUserSchema), async (c) => {
    const userData = c.req.valid("json");
    const newUser = await createUser(c.var.db, userData);
    return successJSend(c, newUser, 201);
  })
  .get("/:id", async (c) => {
    const user = await getUser(c.var.db, c.req.param("id"));
    if (!user) return itemNotFoundFail(c, "user");
    return successJSend(c, user);
  })
  .patch("/:id", zValidator("json", updateUserSchema), async (c) => {
    const currentUserId = c.var.USER?.id;
    if (!currentUserId)
      return failJSend(c, "Authentication required", 401, "AUTH_REQUIRED");

    const updatedUser = await updateUser(
      c.var.db,
      c.req.param("id"),
      c.req.valid("json"),
      currentUserId,
    );
    return successJSend(c, updatedUser);
  })
  .delete("/:id", async (c) => {
    const currentUserId = c.var.USER?.id;
    if (!currentUserId) return failJSend(c, "Authentication required", 401);

    const deletedUser = await deleteUser(
      c.var.db,
      c.req.param("id"),
      currentUserId,
    );
    return successJSend(c, deletedUser);
  });
