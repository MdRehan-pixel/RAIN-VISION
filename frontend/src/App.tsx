import { Routes, Route } from "react-router-dom";
import RainVision from "@/pages/RainVision";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <Routes>
      <Route path="*" element={<RainVision />} />
    </Routes>
  );
}
