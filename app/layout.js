import "./globals.css";
import { AuthProvider } from "../lib/AuthProvider";
import { ThemeProvider } from "../lib/ThemeProvider";

export const metadata = {
  title: "ACKnet — Academy of Christ the King",
  description: "The Academy of Christ the King's platform for discussion, teaching, and testing.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
