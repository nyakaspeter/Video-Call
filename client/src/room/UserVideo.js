import React, { useState } from "react";

export const UserVideo = (props) => {
  const [circleView, setCircleView] = useState(true);

  return (
    <div
      className="User-video-container"
      style={
        circleView
          ? { width: "72px", height: "72px", borderRadius: "36px" }
          : { height: "144px", borderRadius: "8px" }
      }
    >
      <video
        onClick={() => setCircleView(!circleView)}
        className="Video"
        playsInline
        autoPlay
        muted
        ref={props.streamRef}
        style={
          props.camEnabled
            ? circleView
              ? {}
              : { width: "initial", objectFit: "contain" }
            : { display: "none" }
        }
      />
    </div>
  );
};
