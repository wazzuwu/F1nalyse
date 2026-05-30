import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Ticker from "./components/Ticker";
import AiFloatingButton from "./components/AiFloatingButton";

const Home = lazy(() => import("./pages/Home"));
const LiveSeason = lazy(() => import("./pages/LiveSeason"));
const Analysis = lazy(() => import("./pages/Analysis"));
const RaceStrategy = lazy(() => import("./pages/RaceStrategy"));
const AiSteward = lazy(() => import("./pages/AiSteward"));
const DriverDetail = lazy(() => import("./pages/DriverDetail"));
const CircuitDetail = lazy(() => import("./pages/CircuitDetail"));
const ConstructorDetail = lazy(() => import("./pages/ConstructorDetail"));

export default function App() {
  return (
    <div className="min-h-screen bg-f1-black text-white">
      <Navbar />
      <Suspense fallback={<div className="h-screen" />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/live" element={<LiveSeason />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/strategy" element={<RaceStrategy />} />
          <Route path="/steward" element={<AiSteward />} />
          <Route path="/driver/:code" element={<DriverDetail />} />
          <Route path="/circuit/:key" element={<CircuitDetail />} />
          <Route path="/constructor/:slug" element={<ConstructorDetail />} />
        </Routes>
      </Suspense>
      <Footer />
      <Ticker />
      <AiFloatingButton />
    </div>
  );
}
