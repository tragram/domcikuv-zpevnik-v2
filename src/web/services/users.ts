import { UserDB } from "src/lib/db/schema/auth.schema";
import client from "../../worker/api-client";
import { handleApiResponse, makeApiRequest } from "./apiHelpers";
import {
  CreateUserSchema,
  UpdateUserSchema,
  UsersResponse,
} from "src/worker/api/admin/users";
import { parseDBDates } from "./songs";

export type UsersApi = typeof client.api.admin.users;

interface UserSearchParams {
  search?: string;
  limit?: number;
  offset?: number;
}

export async function fetchProfile(api: typeof client.api) {
  const response = await makeApiRequest(api.profile.$get);
  return response;
}

/**
 * Fetches all users with optional search and pagination
 * @param api - The users API client
 * @param params - Search and pagination parameters
 * @returns Promise with users and pagination info
 * @throws {ApiException} When the request fails
 */
export async function fetchUsersAdmin(
  api: UsersApi,
  params?: UserSearchParams
): Promise<UsersResponse> {
  const response = await makeApiRequest(() =>
    api.$get({
      query: {
        search: params?.search,
        limit: params?.limit?.toString(),
        offset: params?.offset?.toString(),
      },
    })
  );
  response.users = response.users.map(parseDBDates);
  return response;
}

/**
 * Fetches a single user by ID
 * @param api - The users API client
 * @param userId - The ID of the user to fetch
 * @returns Promise containing the user data
 * @throws {ApiException} When the user cannot be found or request fails
 */
export async function fetchUserAdmin(
  api: UsersApi,
  userId: string
): Promise<UserDB> {
  const response = await makeApiRequest(() =>
    api[":id"].$get({
      param: { id: userId },
    })
  );
  return response;
}

/**
 * Creates a new user
 * @param api - The users API client
 * @param userData - The user data to create
 * @returns Promise containing the creation result and user data
 * @throws {ApiException} When user creation fails (e.g., email already exists)
 */
export async function createUserAdmin(
  api: UsersApi,
  userData: CreateUserSchema
): Promise<{ success: boolean; user: UserDB }> {
  const response = await makeApiRequest(() =>
    api.$post({
      json: userData,
    })
  );
  return response;
}

/**
 * Updates an existing user
 * @param api - The users API client
 * @param userId - The ID of the user to update
 * @param userData - The user data to update
 * @returns Promise containing the update result and user data
 * @throws {ApiException} When user update fails or user not found
 */
export async function updateUserAdmin(
  api: UsersApi,
  userId: string,
  userData: UpdateUserSchema
): Promise<{ success: boolean; user: UserDB }> {
  console.log(userId, userData);
  const response = await makeApiRequest(() =>
    api[":id"].$put({
      param: { id: userId },
      json: userData,
    })
  );
  return response;
}

/**
 * Deletes a user
 * @param api - The users API client
 * @param userId - The ID of the user to delete
 * @returns Promise containing the deletion result
 * @throws {ApiException} When user deletion fails or user not found
 */
export async function deleteUserAdmin(
  api: UsersApi,
  userId: string
): Promise<{ success: boolean }> {
  const response = await makeApiRequest(() =>
    api[":id"].$delete({
      param: { id: userId },
    })
  );
  return { success: true };
}
