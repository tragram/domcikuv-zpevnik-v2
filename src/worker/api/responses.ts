import { Context } from "hono";
import { ContentfulStatusCode } from "hono/utils/http-status";

export const successJSend = <T>(
  c: Context,
  data: T,
  status: ContentfulStatusCode = 200
) => {
  return c.json(
    {
      status: "success",
      data,
    },
    status
  );
};

export const failJSend = (
  c: Context,
  message: string,
  status: ContentfulStatusCode = 400,
  code?: string
) => {
  return c.json(
    {
      status: "fail",
      failData: {
        message,
        code,
      },
    },
    status
  );
};

export const errorJSend = (
  c: Context,
  message: string,
  status: ContentfulStatusCode = 500,
  code?: string
) => {
  return c.json(
    {
      status: "error",
      message,
      code,
    },
    status
  );
};

export const itemNotFoundFail = (c: Context, item: string) => {
  return failJSend(
    c,
    `Referenced ${item} not found`,
    400,
    `${item.toUpperCase()}_NOT_FOUND`
  );
};

export const songNotFoundFail = (c: Context) => {
  return itemNotFoundFail(c, "song");
};

export const errorFail = (c: Context, error: Error) => {
  return failJSend(c, error.message, 400, error.cause?.toString());
};

export const notLoggedInFail = (c: Context) => {
  return failJSend(
    c,
    "Cannot add favorite song - no user logged in!",
    401,
    "NOT_LOGGED_IN"
  );
};
