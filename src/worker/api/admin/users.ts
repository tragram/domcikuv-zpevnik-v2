import { drizzle } from "drizzle-orm/d1";
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
import {
  errorFail,
  errorJSend,
  failJSend,
  itemNotFoundFail,
  successJSend,
} from "../responses";

export const userRoutes = buildApp()
  .get("/", zValidator("query", userSearchSchema), async (c) => {
    try {
      const { search, limit, offset } = c.req.valid("query");
      const db = drizzle(c.env.DB);
      const usersResponse = await getUsers(db, search, limit, offset);
      return successJSend(c, usersResponse);
    } catch (error) {
      console.error("Error fetching users:", error);
      return errorJSend(c, "Failed to fetch users", 500, "FETCH_ERROR");
    }
  })
  .post("/", zValidator("json", createUserSchema), async (c) => {
    try {
      const userData = c.req.valid("json");
      const db = drizzle(c.env.DB);
      const newUser = await createUser(db, userData);
      return successJSend(c, newUser, 201);
    } catch (error) {
      console.error("Error creating user:", error);
      if (error instanceof Error) {
        return failJSend(c, error.message, 400, error.cause?.toString());
      }
      return errorJSend(c, "Failed to create user", 500, "CREATE_ERROR");
    }
  })
  .get("/:id", async (c) => {
    try {
      const userId = c.req.param("id");
      const db = drizzle(c.env.DB);
      const user = await getUser(db, userId);

      if (!user) {
        return itemNotFoundFail(c, "user");
      }

      return successJSend(c, user);
    } catch (error) {
      console.error("Error fetching user:", error);
      return errorJSend(c, "Failed to fetch user", 500, "FETCH_ERROR");
    }
  })
  .patch("/:id", zValidator("json", updateUserSchema), async (c) => {
    try {
      const userId = c.req.param("id");
      const userData = c.req.valid("json");
      const currentUserId = c.get("USER")?.id;
      const db = drizzle(c.env.DB);

      if (!currentUserId) {
        return errorJSend(c, "Authentication required", 401, "AUTH_REQUIRED");
      }

      const updatedUser = await updateUser(db, userId, userData, currentUserId);
      return successJSend(c, updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      if (error instanceof Error) {
        return failJSend(c, error.message, 400, error.cause?.toString());
      }
      return errorJSend(c, "Failed to update user", 500, "UPDATE_ERROR");
    }
  })
  .delete("/:id", async (c) => {
    try {
      const userId = c.req.param("id");
      const db = drizzle(c.env.DB);
      const currentUserId = c.get("USER")?.id;

      if (!currentUserId) {
        return errorJSend(c, "Authentication required", 401, "AUTH_REQUIRED");
      }

      const deletedUser = await deleteUser(db, userId, currentUserId);
      return successJSend(c, deletedUser);
    } catch (error) {
      console.error("Error deleting user:", error);
      if (error instanceof Error) {
        return errorFail(c, error);
      }
      return errorJSend(c, "Failed to delete user", 500, "DELETE_ERROR");
    }
  });