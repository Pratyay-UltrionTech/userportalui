import React from "react";
import { Navigate, createHashRouter } from "react-router";
import { AuthPage } from "./pages/AuthPage";
import { ProfileSetup } from "./pages/ProfileSetup";
import { ServiceHistoryPage } from "./pages/ServiceHistoryPage";
import { HomePage } from "./pages/HomePage";
import { BranchSelection } from "./pages/BranchSelection";
import { AddOnsPage } from "./pages/AddOnsPage";
import { DateTimePage } from "./pages/DateTimePage";
import { BookingSummary } from "./pages/BookingSummary";
import { PaymentPage } from "./pages/PaymentPage";
import { SuccessPage } from "./pages/SuccessPage";
import { ServicesPage } from "./pages/ServicesPage";
import { MainLayout } from "./components/MainLayout";
import { ErrorPage } from "./pages/ErrorPage";
import { LandingPage } from "./pages/LandingPage";
import { useBooking } from "./context/BookingContext";

/**
 * Guard for booking-flow pages. If there is no active booking session
 * (i.e. the user pasted the URL into a new tab), redirect to the hero page.
 * Within the same tab the sessionStorage state is preserved, so refreshing
 * or navigating back still works correctly.
 */
function BookingFlowGuard({ children }: { children: React.ReactNode }) {
  const { serviceType } = useBooking();
  if (!serviceType) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export const router = createHashRouter([
  {
    path: "/",
    Component: MainLayout,
    errorElement: <ErrorPage />,
    children: [
      { index: true, Component: LandingPage },
      { path: "login", Component: AuthPage },
      { path: "profile-setup", Component: ProfileSetup },
      { path: "service-history", Component: ServiceHistoryPage },
      { path: "services", Component: ServicesPage },
      { path: "home", Component: HomePage },
      {
        path: "branch/:branchId",
        element: (
          <BookingFlowGuard>
            <BranchSelection />
          </BookingFlowGuard>
        ),
      },
      {
        path: "add-ons",
        element: (
          <BookingFlowGuard>
            <AddOnsPage />
          </BookingFlowGuard>
        ),
      },
      { path: "addons", element: <Navigate to="/add-ons" replace /> },
      {
        path: "datetime",
        element: (
          <BookingFlowGuard>
            <DateTimePage />
          </BookingFlowGuard>
        ),
      },
      {
        path: "summary",
        element: (
          <BookingFlowGuard>
            <BookingSummary />
          </BookingFlowGuard>
        ),
      },
      {
        path: "payment",
        element: (
          <BookingFlowGuard>
            <PaymentPage />
          </BookingFlowGuard>
        ),
      },
      {
        path: "success",
        element: (
          <BookingFlowGuard>
            <SuccessPage />
          </BookingFlowGuard>
        ),
      },
    ],
  },
]);
