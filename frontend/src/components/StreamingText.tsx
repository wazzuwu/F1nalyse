import { useState, useEffect, useRef } from "react";
import FormattedText from "./FormattedText";

interface Props {
  text: string;
  speed?: number;
  onComplete?: () => void;
}

export default function StreamingText({ text, speed = 8, onComplete }: Props) {
  const [displayed, setDisplayed] = useState("");
  const indexRef = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    indexRef.current = 0;
    setDisplayed("");
    let lastTime = 0;

    const animate = (time: number) => {
      if (time - lastTime < speed) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }
      lastTime = time;
      indexRef.current += 1;
      if (indexRef.current <= text.length) {
        setDisplayed(text.slice(0, indexRef.current));
        rafRef.current = requestAnimationFrame(animate);
      } else {
        onComplete?.();
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [text, speed, onComplete]);

  return <FormattedText text={displayed} />;
}
