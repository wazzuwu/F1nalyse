const messages = [
  "F1nalyse — AI-Powered F1 Intelligence • Race analysis • Telemetry • Penalty prediction",
  "Live Season — pick any year from 2000 • Standings • Race calendar • Latest results",
  "Race results include FIA incident records • DNFs • Fastest lap • Podium",
];

export default function Ticker() {
  return (
    <div className="ticker-wrap">
      <div className="ticker-marquee">
        {messages.join(" &nbsp;&nbsp;—&nbsp;&nbsp; ")}
        &nbsp;&nbsp;—&nbsp;&nbsp;
        {messages.join(" &nbsp;&nbsp;—&nbsp;&nbsp; ")}
      </div>
    </div>
  );
}
