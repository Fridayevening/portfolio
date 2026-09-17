"use client";

import { useDesktop } from "./context";

const PAPER = "#f4f1e4";
const FRAME = "#b9b19a";
const TITLE = "#1f1d17";
const TEXT = "#2f2c24";
const SIG = "#86806c";

export default function DisclaimerNote() {
  const api = useDesktop();
  return (
    <div
      className="absolute left-1/2 top-[14px] z-[12] w-[216px] select-none px-[10px] pt-[9px] pb-[8px] text-[10.8px] leading-[1.45]"
      style={{
        transform: "translateX(-50%) rotate(-0.5deg)",
        background: PAPER,
        boxShadow: `0 0 0 1px ${FRAME}, 2px 3px 0 rgba(0,0,0,.18), 5px 7px 14px rgba(0,0,0,.22)`,
        color: TEXT,
        fontFamily:
          'Tahoma, "MS Sans Serif", Geneva, Verdana, "PingFang SC", "Microsoft YaHei", sans-serif',
      }}
    >
      {/* Tape. */}
      <span
        className="absolute left-1/2 top-[-8px] h-[18px] w-[74px] -translate-x-1/2 rotate-[2deg] bg-white/55"
        style={{ boxShadow: "0 1px 2px rgba(0,0,0,.18)" }}
      />
      <p className="m-0 mb-[5px]">
        <b style={{ color: TITLE }}>A NOTE ABOUT ALL THIS</b>
      </p>
      <p className="m-0 mb-[5px]">Parody project. No shareholders, no KPIs. Every number here is made up. An all-purpose toolbox that solves none of your problems.</p>
      <p className="m-0 mb-[5px]">Every tool may break, but that&apos;s a feature, not a bug.</p>
      <p className="m-0 mb-[5px]">If something goes wrong, stay patient with the screen, or gently slap both sides of the case.</p>
      <button
        type="button"
        className="m-0 block w-full cursor-pointer text-left italic"
        style={{ color: SIG }}
        onClick={() => api.open("readme")}
      >
        Click for the longer version.
      </button>
    </div>
  );
}
