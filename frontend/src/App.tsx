import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ClaimsList from "./pages/ClaimsList";
import ClaimDetail from "./pages/ClaimDetail";
import NewClaim from "./pages/NewClaim";
import Analytics from "./pages/Analytics";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<ClaimsList />} />
        <Route path="claims/new" element={<NewClaim />} />
        <Route path="claims/:claimId" element={<ClaimDetail />} />
        <Route path="analytics" element={<Analytics />} />
      </Route>
    </Routes>
  );
}

export default App;
