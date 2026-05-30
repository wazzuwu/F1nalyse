import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="bg-f1-black py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-7xl mx-auto">

        <div className="flex flex-wrap justify-between gap-y-12 lg:gap-x-8">

          {/* Logo + Tagline */}
          <div className="w-full md:w-[45%] lg:w-[35%] flex flex-col items-center md:items-start text-center md:text-left">
            <Link to="/">
              <span className="font-heading text-2xl font-800 tracking-widest text-white">
                F1<span className="text-f1-red">nalyse</span>
              </span>
            </Link>
            <div className="w-full max-w-52 h-px mt-8 bg-linear-to-r from-f1-black via-f1-red/30 to-f1-black" />
            <p className="text-sm text-white/50 mt-6 max-w-sm leading-relaxed font-body">
              AI-powered Formula 1 intelligence — race analytics, telemetry, and penalty prediction driven by real FIA precedent data.
            </p>
          </div>

          {/* Important Links */}
          <div className="w-full md:w-[45%] lg:w-[15%] flex flex-col items-center md:items-start text-center md:text-left">
            <h3 className="text-sm text-white font-medium font-heading">Quick Links</h3>
            <div className="flex flex-col gap-2 mt-6">
              <Link to="/" className="text-sm text-white/50 hover:text-f1-red transition-colors font-body">Home</Link>
              <Link to="/live" className="text-sm text-white/50 hover:text-f1-red transition-colors font-body">Live Season</Link>
              <Link to="/analysis" className="text-sm text-white/50 hover:text-f1-red transition-colors font-body">Analysis</Link>
              <Link to="/steward" className="text-sm text-white/50 hover:text-f1-red transition-colors font-body">AI Steward</Link>
            </div>
          </div>

          {/* Social Links */}
          <div className="w-full md:w-[45%] lg:w-[15%] flex flex-col items-center md:items-start text-center md:text-left">
            <h3 className="text-sm text-white font-medium font-heading">Social</h3>
            <div className="flex flex-col gap-2 mt-6">
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-sm text-white/50 hover:text-f1-red transition-colors font-body">GitHub</a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-sm text-white/50 hover:text-f1-red transition-colors font-body">Twitter / X</a>
            </div>
          </div>

          {/* Subscribe */}
          <div className="w-full md:w-[45%] lg:w-[25%] flex flex-col items-center md:items-start text-center md:text-left">
            <h3 className="text-sm text-white font-medium font-heading">Stay Updated</h3>
            <div className="flex items-center border gap-2 border-white/10 h-13 max-w-80 w-full rounded-full overflow-hidden mt-4">
              <input
                type="email"
                placeholder="Enter your email"
                className="w-full h-full pl-6 outline-none text-sm bg-transparent text-white placeholder-white/40 placeholder:text-xs font-body"
              />
              <button
                type="submit"
                className="bg-linear-to-b from-f1-red to-[#b80024] active:scale-95 transition w-40 h-10 rounded-full text-sm text-white cursor-pointer mr-1.5 font-body font-500"
              >
                Subscribe
              </button>
            </div>
          </div>

        </div>

        {/* Bottom divider */}
        <div className="w-full h-px mt-16 mb-4 bg-linear-to-r from-f1-black via-white/10 to-f1-black" />

        {/* Copyright */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/40 font-body">&copy; 2026 F1nalyse</p>
          <div className="flex items-center gap-6">
            <Link to="/" className="text-xs text-white/40 hover:text-white transition-colors font-body">Privacy Policy</Link>
            <div className="w-px h-4 bg-white/10" />
            <Link to="/" className="text-xs text-white/40 hover:text-white transition-colors font-body">Terms of Service</Link>
          </div>
        </div>

      </div>
    </footer>
  );
}
