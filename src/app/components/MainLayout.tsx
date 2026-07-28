import { Outlet, useLocation } from "react-router";
import { AuthProvider } from "../context/AuthContext";
import { BookingProvider } from "../context/BookingContext";
import { UserNavbar } from "./UserNavbar";
import { useInactivityLogout } from "../hooks/useInactivityLogout";

/** Mounts the inactivity-logout watcher inside the AuthProvider tree. Renders nothing. */
function InactivityWatcher() {
  useInactivityLogout();
  return null;
}

export function MainLayout() {
  const { pathname } = useLocation();
  const hideNavbar = pathname === "/";

  return (
    <AuthProvider>
      <BookingProvider>
        <div className="min-h-screen bg-white">
          <InactivityWatcher />
          {!hideNavbar && <UserNavbar />}
          <Outlet />
        </div>
      </BookingProvider>
    </AuthProvider>
  );
}