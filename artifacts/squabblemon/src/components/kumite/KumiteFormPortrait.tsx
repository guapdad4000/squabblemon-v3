import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import { cardMotionReduced } from "../../lib/cardFinish";
import "../../styles/kumite-forms.css";
/** A bounded cross-dissolve only when artwork changes, with intact original-art fallback. */
export function KumiteFormPortrait({
  formAsset,
  stance,
  src,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & {
  formAsset?: string;
  stance?: string | null;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const current = formAsset && failed !== formAsset ? formAsset : src;
  const previous = useRef(current),
    [leaving, setLeaving] = useState<string | undefined>();
  useEffect(() => {
    const old = previous.current;
    previous.current = current;
    if (!stance || old === current || !old || cardMotionReduced()) {
      setLeaving(undefined);
      return;
    }
    setLeaving(old);
    const timer = setTimeout(() => setLeaving(undefined), 320);
    return () => {
      clearTimeout(timer);
    };
  }, [current, stance]);
  return (
    <>
      {leaving && (
        <span
          className={`kumite-form-flash ${stance === "awakened" && formAsset?.includes("sho-nuff") ? "kumite-form-flash--red" : ""}`}
          aria-hidden="true"
        />
      )}
      {leaving && (
        <img
          {...props}
          src={leaving}
          alt=""
          aria-hidden="true"
          className={`${props.className ?? ""} kumite-form-leaving`}
        />
      )}
      <img
        {...props}
        src={current}
        data-kumite-form={stance ?? undefined}
        className={`${props.className ?? ""} ${leaving ? "kumite-form-entering" : ""}`}
        onError={(e) => {
          if (formAsset && failed !== formAsset) setFailed(formAsset);
          else props.onError?.(e);
        }}
      />
    </>
  );
}
