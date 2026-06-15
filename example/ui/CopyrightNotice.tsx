import { useIsTouchDevice } from "./useIsTouchDevice";

export function CopyrightNotice() {
  const isTouchDevice = useIsTouchDevice();

  return (
    <div className={["copyrightNotice", isTouchDevice ? "is-touch" : ""].filter(Boolean).join(" ")}>
      <div className="copyrightNoticeLine">
        <a href="https://github.com/pmndrs/ecctrl" target="_blank" rel="noreferrer">Ecctrl</a>
        <span>© 2023-2026</span>
        <a href="https://github.com/ErdongChen-Andrew" target="_blank" rel="noreferrer">Erdong Chen</a>
        <span>· MIT License</span>
      </div>
      <div className="copyrightNoticeLine">
        <span>Animations by Quaternius -</span>
        <a href="https://quaternius.itch.io/universal-animation-library" target="_blank" rel="noreferrer">
          Universal Animation Library
        </a>
        <span>(CC0)</span>
      </div>
    </div>
  );
}
