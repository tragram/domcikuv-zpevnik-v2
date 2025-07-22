import client from "../../worker/api-client";

type UsersApi = typeof client.api.admin.users;

interface User {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string;
  nickname?: string;
  isTrusted: boolean;
  isAdmin: boolean;
  isFavoritesPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLogin: Date;
}

interface UserSearchParams {
  search?: string;
  limit?: number;
  offset?: number;
}

interface UsersResponse {
  users: User[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface CreateUserData {
  name: string;
  email: string;
  emailVerified?: boolean;
  image?: string;
  nickname?: string;
  isTrusted?: boolean;
  isAdmin?: boolean;
  isFavoritesPublic?: boolean;
}

interface UpdateUserData extends Partial<CreateUserData> {}

export async function fetchUsersAdmin(
  api: UsersApi,
  params?: UserSearchParams
): Promise<UsersResponse> {
  try {
    const response = await api.$get({
      query: {
        search: params?.search,
        limit: params?.limit?.toString(),
        offset: params?.offset?.toString(),
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(errorData.error || "Failed to fetch users");
    }
    
    return response.json();
  } catch (error) {
    console.error("Error in fetchUsersAdmin:", error);
    throw error;
  }
}

export async function fetchUserAdmin(
  api: UsersApi,
  userId: string
): Promise<User> {
  const response = await api[':id'].$get({
    param: { id: userId },
  });
  if (!response.ok) {
    throw new Error("Failed to fetch user");
  }
  return response.json();
}

export async function createUserAdmin(
  api: UsersApi,
  userData: CreateUserData
): Promise<{ success: boolean; user: User }> {
  const response = await api.$post({
    json: userData,
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create user");
  }
  return response.json();
}

export async function updateUserAdmin(
  api: UsersApi,
  userId: string,
  userData: UpdateUserData
): Promise<{ success: boolean; user: User }> {
  const response = await api[':id'].$put({
    param: { id: userId },
    json: userData,
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update user");
  }
  return response.json();
}

export async function deleteUserAdmin(
  api: UsersApi,
  userId: string
): Promise<{ success: boolean }> {
  const response = await api[':id'].$delete({
    param: { id: userId },
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete user");
  }
  return response.json();
}