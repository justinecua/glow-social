import SparksHost from "@/features/sparks/SparksHost";
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { setUser } from "@/redux/slices/authSlice";

import RootLayout from "./features/dashboard/pages/RootLayout";
import { Routes, Route } from "react-router-dom";
import Home from "./features/dashboard/pages/Home";
import About from "./features/dashboard/pages/About";
import LoginPage from "./features/auth/pages/Login";
import Explore from "./features/dashboard/pages/Explore";
import { ThemeProvider } from "@/components/themes/theme-provider";
import "./index.css";
import RegisterPage from "./features/auth/pages/Register";
import ProfilePage from "./features/profile/pages/profile";
import { Toaster } from "@/components/ui/sonner";
import ForgotPassword from "./features/auth/pages/ForgotPassword";
import ResetPassword from "./features/auth/pages/ResetPassword";
import { WebSocketProvider } from "./utils/WebSocketContext";
import { useGetMeQuery } from "./redux/services/auth/auth";
import Terms from "./features/legal/pages/Terms";
import Privacy from "./features/legal/pages/Privacy";
import Guidelines from "./features/legal/pages/Guidelines";
import SettingsPage from "./features/settings/pages/Settings";
import SearchPage from "./features/discover/pages/Search";
import FriendsPage from "./features/discover/pages/Friends";
import InvitePage from "./features/growth/InvitePage";
import PostPage from "./features/growth/PostPage";
import MessagesPage from "./features/messages/MessagesPage";
import ChatRealtime from "./features/messages/ChatRealtime";
import NotificationsRealtime from "./features/dashboard/components/Notifications/NotificationsRealtime";

function App() {
  const dispatch = useDispatch();
  const { data, error } = useGetMeQuery();

  useEffect(() => {
    if (data?.user) {
      // Store the same shape the login page stores: { user: {...} }
      dispatch(setUser(data));
    }
  }, [data, dispatch]);

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <WebSocketProvider>
        <RootLayout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/about" element={<About />} />
            <Route path="/cars" element={null} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgotpassword" element={<ForgotPassword />} />
            <Route path="/resetpassword" element={<ResetPassword />} />
            <Route path="/profile/:id" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/friends" element={<FriendsPage />} />
            <Route path="/invite/:username" element={<InvitePage />} />
            <Route path="/post/:id" element={<PostPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/messages/:id" element={<MessagesPage />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/guidelines" element={<Guidelines />} />
          </Routes>
          <SparksHost />

          <ChatRealtime />
          <NotificationsRealtime />
          <Toaster position="bottom-right" />
        </RootLayout>
      </WebSocketProvider>
    </ThemeProvider>
  );
}

export default App;
