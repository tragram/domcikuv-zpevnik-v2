import { createFileRoute, Link } from "@tanstack/react-router";
import {
  deleteUser,
  signIn,
  signOut,
  signUp,
  useSession,
} from "../../lib/auth/client";

export const Route = createFileRoute("/user")({
  component: About,
  pendingComponent: () => <div>Loading...</div>,
});

function About() {
  const session = useSession();
  const name = session.data?.user ? session.data.user.name : "Guest";
  return (
    <div className="p-2">
      <Link to="/" className="underline" preload="intent">
        Back to home
      </Link>
      <h3 className="text-2xl font-bold">Hello {name}!</h3>
      <div className="flex flex-col gap-2">
        <button
          onClick={() => {
            signUp.email({
              email: "test@test.com",
              password: "test123456",
              name: "test",
            });
          }}
          className="bg-blue-500 text-white p-2 rounded-md"
        >
          Sign up as test user
        </button>
        <button
          onClick={() => {
            signIn.email({
              email: "test@test.com",
              password: "test123456",
            });
          }}
          className="bg-blue-500 text-white p-2 rounded-md"
        >
          Sign in as test user
        </button>
        <button
          onClick={() => {
            signOut();
          }}
          className="bg-red-500 text-white p-2 rounded-md"
        >
          Sign out
        </button>
        <button
          onClick={() => deleteUser()}
          className="bg-red-500 text-white p-2 rounded-md"
        >
          Delete user
        </button>
      </div>
    </div>
  );
}
